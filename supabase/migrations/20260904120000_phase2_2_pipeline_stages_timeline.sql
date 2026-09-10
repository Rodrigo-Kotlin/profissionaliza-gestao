-- ============================================================================
-- PHASE 2.2 — PIPELINE STAGES, LEAD STAGE ON CREATE/UPDATE, TIMELINE
-- 20260904120000_phase2_2_pipeline_stages_timeline.sql
--
-- 1. list_crm_pipeline_stages()       — lista etapas ativas
-- 2. _crm_validate_stage_move()       — helper interno de validação
-- 3. create_crm_lead (expandido)      — p_stage_id para iniciar em etapa customizada
-- 4. update_crm_lead (expandido)      — p_stage_id para mover durante edição
-- 5. get_crm_lead_timeline()          — timeline paginada de eventos
-- 6. list_crm_lead_activities()       — atividades paginadas de um lead
-- 7. GRANTS                           — execução controlada
-- 8. NOTIFY pgrst                     — reload schema cache
--
-- Segurança:
--   - SECURITY DEFINER + search_path = pg_catalog, public em todas as funções
--   - _crm_validate_stage_move NÃO recebida por nenhuma role (helper interno)
--   - Funções públicas recebem GRANT apenas em authenticated
--   - REVOKE de public e anon
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. list_crm_pipeline_stages() — etapas ativas do pipeline
-- ---------------------------------------------------------------------------
create or replace function public.list_crm_pipeline_stages()
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') and not public.has_permission('crm.create') then
    raise exception 'Permission denied: crm.view or crm.create' using errcode = '42501';
  end if;

  select coalesce(json_agg(s order by s.position), '[]'::json)
  into v_rows
  from (
    select
      st.id,
      st.code,
      st.name,
      st.position,
      st.probability,
      st.is_active
    from public.crm_pipeline_stages st
    where st.is_active = true
    order by st.position asc
  ) s;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. _crm_validate_stage_move() — helper interno (não exposto via GRANT)
--
--    Valida que a etapa existe e está ativa.
--    Se code = 'QUALIFIED', exige course_interest_id não nulo.
--    Retorna o stage_id validado ou lança exceção.
-- ---------------------------------------------------------------------------
create or replace function public._crm_validate_stage_move(
  p_stage_id uuid,
  p_course_interest_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_stage record;
begin
  if p_stage_id is null then
    raise exception 'Stage ID is required' using errcode = '22023';
  end if;

  select id, code, name, is_active
  into v_stage
  from public.crm_pipeline_stages
  where id = p_stage_id;

  if v_stage is null then
    raise exception 'Stage not found' using errcode = 'P0002';
  end if;

  if v_stage.is_active = false then
    raise exception 'Stage is inactive' using errcode = '22023';
  end if;

  -- Etapa QUALIFIED requer curso de interesse
  if v_stage.code = 'QUALIFIED' and p_course_interest_id is null then
    raise exception 'Course interest is required to move lead to QUALIFIED stage' using errcode = '22023';
  end if;

  return v_stage.id;
end;
$$;

-- NÃO conceder permissão de execução a ninguém — helper interno
-- (revogar publicamente por segurança, embora SECURITY DEFINER já proteja)
revoke execute on function public._crm_validate_stage_move(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. create_crm_lead — DROP antigo + CREATE expandido com p_stage_id
--
--    Assinatura corrente (runtime_fixes, 13 params):
--      text,text,text,text,text,uuid,uuid,text,text,text,text,timestamptz
--    Nova assinatura (13 params — p_stage_id uuid adicionado):
--      text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz
-- ---------------------------------------------------------------------------
-- DROP assinatura corrente do runtime_fixes (13 params com commercial_notes)
drop function if exists public.create_crm_lead(
  text, text, text, text, text, uuid, uuid, text, text, text, text, timestamptz
);

-- DROP assinatura variantante (caso exista em algum ambiente intermédio sem p_owner_user_id duplicado)
drop function if exists public.create_crm_lead(
  text, text, text, text, text, uuid, text, text, text, text, text, text, timestamptz
);

create or replace function public.create_crm_lead(
  p_full_name text,
  p_phone text default null,
  p_whatsapp text default null,
  p_email text default null,
  p_source_code text default 'OUTRO',
  p_course_interest_id uuid default null,
  p_owner_user_id uuid default null,
  p_stage_id uuid default null,
  p_temperature text default null,
  p_commercial_notes text default null,
  p_first_activity_title text default null,
  p_first_activity_type text default 'OTHER',
  p_first_activity_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person_id uuid;
  v_lead_id uuid;
  v_lead_code text;
  v_stage_id uuid;
  v_source_id uuid;
  v_owner uuid;
  v_normalized_phone text;
  v_normalized_whatsapp text;
  v_normalized_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.create') then
    raise exception 'Permission denied: crm.create' using errcode = '42501';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;

  if p_temperature is not null and p_temperature not in ('HOT','WARM','COLD') then
    raise exception 'Invalid temperature' using errcode = '22023';
  end if;

  -- Owner: validação
  v_owner := coalesce(p_owner_user_id, auth.uid());
  if v_owner <> auth.uid() and not public.has_permission('crm.assign') then
    raise exception 'Permission denied: crm.assign' using errcode = '42501';
  end if;
  -- Verificar se o owner existe
  if not exists (select 1 from public.profiles where id = v_owner and is_active) then
    raise exception 'Invalid owner user' using errcode = '22023';
  end if;

  -- Normalizações
  v_normalized_phone := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_normalized_whatsapp := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  -- Busca source
  select id into v_source_id from public.crm_lead_sources where code = p_source_code limit 1;

  -- Resolução da stage inicial
  if p_stage_id is not null then
    -- Validação via helper interno
    v_stage_id := public._crm_validate_stage_move(p_stage_id, p_course_interest_id);

    -- Se não é NEW_LEAD, precisa da permissão crm.move_stage
    if (select code from public.crm_pipeline_stages where id = v_stage_id) <> 'NEW_LEAD' then
      if not public.has_permission('crm.move_stage') then
        raise exception 'Permission denied: crm.move_stage (required for non-NEW_LEAD initial stage)' using errcode = '42501';
      end if;
    end if;
  else
    -- Comportamento padrão: busca NEW_LEAD
    select id into v_stage_id from public.crm_pipeline_stages where code = 'NEW_LEAD';
  end if;

  -- Procura pessoa existente por telefone/whatsapp/email (deduplicação)
  if v_normalized_phone is not null or v_normalized_whatsapp is not null or v_normalized_email is not null then
    select id into v_person_id
    from public.people
    where (v_normalized_phone is not null and phone = v_normalized_phone)
       or (v_normalized_whatsapp is not null and whatsapp = v_normalized_whatsapp)
       or (v_normalized_email is not null and lower(email) = v_normalized_email)
    limit 1;
  end if;

  -- Cria pessoa se não encontrou
  if v_person_id is null then
    insert into public.people (
      full_name, phone, whatsapp, email, created_by, updated_by
    ) values (
      trim(p_full_name), v_normalized_phone, v_normalized_whatsapp, v_normalized_email,
      auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  -- Gera código do lead (concorrente-seguro via sequence)
  v_lead_code := 'LEAD-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.lead_code_seq')::text, 6, '0');

  -- Cria lead com a stage resolvida
  insert into public.crm_leads (
    lead_code, person_id, stage_id, source_id, course_interest_id,
    owner_user_id, status, temperature, commercial_notes,
    created_by, updated_by
  ) values (
    v_lead_code, v_person_id, v_stage_id, v_source_id,
    p_course_interest_id,
    v_owner, 'OPEN', p_temperature,
    nullif(trim(coalesce(p_commercial_notes, '')), ''),
    auth.uid(), auth.uid()
  )
  returning id into v_lead_id;

  -- Histórico inicial (uma única entrada com a etapa correta)
  insert into public.crm_lead_stage_history (lead_id, previous_stage_id, new_stage_id, changed_by, reason)
  values (v_lead_id, null, v_stage_id, auth.uid(), 'Criação do lead');

  -- Primeira atividade (opcional)
  if p_first_activity_title is not null and char_length(trim(p_first_activity_title)) > 0 and p_first_activity_due_at is not null then
    insert into public.crm_activities (
      lead_id, owner_user_id, type, title, due_at, status, created_by
    ) values (
      v_lead_id, v_owner, p_first_activity_type,
      trim(p_first_activity_title), p_first_activity_due_at, 'PENDING', auth.uid()
    );
  end if;

  -- Auditoria
  perform public.write_audit_log(
    'crm.lead_created', 'crm_lead', v_lead_id::text,
    jsonb_build_object(
      'lead_code', v_lead_code,
      'person_id', v_person_id::text,
      'source', p_source_code,
      'stage_id', v_stage_id::text,
      'initial_stage', (select code from public.crm_pipeline_stages where id = v_stage_id)
    )
  );

  return v_lead_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. update_crm_lead — DROP antigo + CREATE expandido com p_stage_id
--
--    Assinatura antiga (13 params, sem stage_id):
--      uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric
--    Nova assinatura (14 params):
--      uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric,uuid
-- ---------------------------------------------------------------------------
drop function if exists public.update_crm_lead(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, numeric, numeric
);

create or replace function public.update_crm_lead(
  p_lead_id uuid,
  p_source_id uuid default null,
  p_course_interest_id uuid default null,
  p_temperature text default null,
  p_commercial_notes text default null,
  p_qualification_start_period text default null,
  p_preferred_shift text default null,
  p_preferred_modality text default null,
  p_budget_notes text default null,
  p_decision_maker text default null,
  p_source_detail text default null,
  p_estimated_value numeric default null,
  p_proposed_value numeric default null,
  p_stage_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead record;
  v_new_stage_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.edit') then
    raise exception 'Permission denied: crm.edit' using errcode = '42501';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  -- Ownership check: vendedor só edita seus leads
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.view_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;

  if v_lead.status <> 'OPEN' then
    raise exception 'Cannot edit closed lead' using errcode = '22023';
  end if;

  if p_temperature is not null and p_temperature not in ('HOT','WARM','COLD') then
    raise exception 'Invalid temperature' using errcode = '22023';
  end if;

  -- ---------------------------------------------------------------
  -- Validação e movimentação de stage (se p_stage_id informado)
  -- ---------------------------------------------------------------
  if p_stage_id is not null and p_stage_id is distinct from v_lead.stage_id then
    -- Requer crm.move_stage
    if not public.has_permission('crm.move_stage') then
      raise exception 'Permission denied: crm.move_stage' using errcode = '42501';
    end if;

    -- Validar via helper interno (verifica existência, ativo, QUALIFIED→course)
    perform public._crm_validate_stage_move(p_stage_id, coalesce(p_course_interest_id, v_lead.course_interest_id));

    -- Buscar código da nova stage para referência
    select code into v_new_stage_code from public.crm_pipeline_stages where id = p_stage_id;

    -- Inserir no histórico de movimentação
    insert into public.crm_lead_stage_history (lead_id, previous_stage_id, new_stage_id, changed_by, reason)
    values (p_lead_id, v_lead.stage_id, p_stage_id, auth.uid(), 'Atualização do lead');

    -- Auditoria
    perform public.write_audit_log(
      'crm.stage_changed', 'crm_lead', p_lead_id::text,
      jsonb_build_object(
        'lead_code', v_lead.lead_code,
        'previous_stage', (select code from public.crm_pipeline_stages where id = v_lead.stage_id),
        'new_stage', v_new_stage_code
      )
    );
  end if;

  -- ---------------------------------------------------------------
  -- Atualização dos demais campos
  -- ---------------------------------------------------------------
  update public.crm_leads set
    source_id = coalesce(p_source_id, source_id),
    course_interest_id = coalesce(p_course_interest_id, course_interest_id),
    temperature = coalesce(p_temperature, temperature),
    qualification_start_period = coalesce(p_qualification_start_period, qualification_start_period),
    preferred_shift = coalesce(p_preferred_shift, preferred_shift),
    preferred_modality = coalesce(p_preferred_modality, preferred_modality),
    budget_notes = coalesce(p_budget_notes, budget_notes),
    decision_maker = coalesce(p_decision_maker, decision_maker),
    source_detail = coalesce(p_source_detail, source_detail),
    estimated_value = coalesce(p_estimated_value, estimated_value),
    proposed_value = coalesce(p_proposed_value, proposed_value),
    commercial_notes = coalesce(p_commercial_notes, commercial_notes),
    -- Atualiza stage_id somente se foi validado acima
    stage_id = case
      when p_stage_id is not null and p_stage_id is distinct from v_lead.stage_id
      then p_stage_id
      else stage_id
    end,
    updated_by = auth.uid()
  where id = p_lead_id;

  perform public.write_audit_log(
    'crm.lead_updated', 'crm_lead', p_lead_id::text,
    jsonb_build_object('lead_code', v_lead.lead_code)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. get_crm_lead_timeline() — timeline paginada de eventos do lead
-- ---------------------------------------------------------------------------
create or replace function public.get_crm_lead_timeline(
  p_lead_id uuid,
  p_page integer default 1,
  p_page_size integer default 50
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_user_id uuid;
  v_exists boolean;
  v_has_view_all boolean;
  v_offset integer;
  v_total bigint;
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  -- Verificar existência do lead
  select exists(select 1 from public.crm_leads where id = p_lead_id)
  into v_exists;

  if not v_exists then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  -- Ownership check
  select owner_user_id into v_owner_user_id from public.crm_leads where id = p_lead_id;

  if v_owner_user_id is distinct from auth.uid() and not v_has_view_all then
    raise exception 'Not authorized to view this lead' using errcode = '42501';
  end if;

  -- Contagem total de eventos do lead
  with all_events as (
    -- LEAD_CREATED
    select
      l.id as event_id,
      'LEAD_CREATED' as event_type,
      l.created_at as occurred_at,
      'Lead criado' as title,
      null::text as description,
      l.created_by as actor_user_id,
      'lead' as entity_type,
      l.id as entity_id,
      '{}'::jsonb as metadata
    from public.crm_leads l
    where l.id = p_lead_id

    union all

    -- STAGE_CHANGED
    select
      sh.id as event_id,
      'STAGE_CHANGED' as event_type,
      sh.changed_at as occurred_at,
      'Etapa alterada' as title,
      (coalesce(ps.name, '(nenhuma)') || ' → ' || coalesce(ns.name, '(nenhuma)')) as description,
      sh.changed_by as actor_user_id,
      'stage' as entity_type,
      sh.lead_id as entity_id,
      jsonb_build_object(
        'previous_stage_id', sh.previous_stage_id,
        'previous_stage_name', ps.name,
        'new_stage_id', sh.new_stage_id,
        'new_stage_name', ns.name,
        'reason', sh.reason
      ) as metadata
    from public.crm_lead_stage_history sh
    left join public.crm_pipeline_stages ps on ps.id = sh.previous_stage_id
    left join public.crm_pipeline_stages ns on ns.id = sh.new_stage_id
    where sh.lead_id = p_lead_id

    union all

    -- ACTIVITY_CREATED
    select
      a.id as event_id,
      'ACTIVITY_CREATED' as event_type,
      a.created_at as occurred_at,
      'Atividade criada' as title,
      a.title as description,
      a.created_by as actor_user_id,
      'activity' as entity_type,
      a.id as entity_id,
      jsonb_build_object('type', a.type, 'status', a.status) as metadata
    from public.crm_activities a
    where a.lead_id = p_lead_id
      and a.status in ('PENDING', 'COMPLETED', 'CANCELED')

    union all

    -- ACTIVITY_COMPLETED
    select
      a.id as event_id,
      'ACTIVITY_COMPLETED' as event_type,
      a.completed_at as occurred_at,
      'Atividade concluída' as title,
      a.title as description,
      a.owner_user_id as actor_user_id,
      'activity' as entity_type,
      a.id as entity_id,
      jsonb_build_object('type', a.type, 'outcome', a.outcome) as metadata
    from public.crm_activities a
    where a.lead_id = p_lead_id
      and a.status = 'COMPLETED'
      and a.completed_at is not null

    union all

    -- ACTIVITY_RESCHEDULED (from audit_logs — graceful if table/column missing)
    select
      al.id as event_id,
      'ACTIVITY_RESCHEDULED' as event_type,
      al.created_at as occurred_at,
      'Atividade reagendada' as title,
      null::text as description,
      al.actor_id as actor_user_id,
      'activity' as entity_type,
      null::uuid as entity_id,
      al.metadata as metadata
    from public.audit_logs al
    where al.action = 'crm.activity_rescheduled'
      and al.metadata ->> 'lead_id' = p_lead_id::text

    union all

    -- ACTIVITY_CANCELED
    select
      a.id as event_id,
      'ACTIVITY_CANCELED' as event_type,
      a.updated_at as occurred_at,
      'Atividade cancelada' as title,
      a.title as description,
      a.updated_by as actor_user_id,
      'activity' as entity_type,
      a.id as entity_id,
      jsonb_build_object('type', a.type) as metadata
    from public.crm_activities a
    where a.lead_id = p_lead_id
      and a.status = 'CANCELED'
      and a.updated_at is not null

    union all

    -- LEAD_LOST
    select
      sh.id as event_id,
      'LEAD_LOST' as event_type,
      sh.changed_at as occurred_at,
      'Lead perdido' as title,
      sh.reason as description,
      sh.changed_by as actor_user_id,
      'lead' as entity_type,
      sh.lead_id as entity_id,
      sh.metadata as metadata
    from public.crm_lead_stage_history sh
    where sh.lead_id = p_lead_id
      and sh.reason = 'Lead perdido'
  )
  select count(*) into v_total from all_events;

  -- Montagem dos eventos com nomes dos atores e paginação
  with all_events as (
    select
      l.id as event_id,
      'LEAD_CREATED' as event_type,
      l.created_at as occurred_at,
      'Lead criado' as title,
      null::text as description,
      l.created_by as actor_user_id,
      'lead' as entity_type,
      l.id as entity_id,
      '{}'::jsonb as metadata
    from public.crm_leads l
    where l.id = p_lead_id

    union all

    select
      sh.id as event_id,
      'STAGE_CHANGED' as event_type,
      sh.changed_at as occurred_at,
      'Etapa alterada' as title,
      (coalesce(ps.name, '(nenhuma)') || ' → ' || coalesce(ns.name, '(nenhuma)')) as description,
      sh.changed_by as actor_user_id,
      'stage' as entity_type,
      sh.lead_id as entity_id,
      jsonb_build_object(
        'previous_stage_id', sh.previous_stage_id,
        'previous_stage_name', ps.name,
        'new_stage_id', sh.new_stage_id,
        'new_stage_name', ns.name,
        'reason', sh.reason
      ) as metadata
    from public.crm_lead_stage_history sh
    left join public.crm_pipeline_stages ps on ps.id = sh.previous_stage_id
    left join public.crm_pipeline_stages ns on ns.id = sh.new_stage_id
    where sh.lead_id = p_lead_id

    union all

    select
      a.id as event_id,
      'ACTIVITY_CREATED' as event_type,
      a.created_at as occurred_at,
      'Atividade criada' as title,
      a.title as description,
      a.created_by as actor_user_id,
      'activity' as entity_type,
      a.id as entity_id,
      jsonb_build_object('type', a.type, 'status', a.status) as metadata
    from public.crm_activities a
    where a.lead_id = p_lead_id
      and a.status in ('PENDING', 'COMPLETED', 'CANCELED')

    union all

    select
      a.id as event_id,
      'ACTIVITY_COMPLETED' as event_type,
      a.completed_at as occurred_at,
      'Atividade concluída' as title,
      a.title as description,
      a.owner_user_id as actor_user_id,
      'activity' as entity_type,
      a.id as entity_id,
      jsonb_build_object('type', a.type, 'outcome', a.outcome) as metadata
    from public.crm_activities a
    where a.lead_id = p_lead_id
      and a.status = 'COMPLETED'
      and a.completed_at is not null

    union all

    select
      al.id as event_id,
      'ACTIVITY_RESCHEDULED' as event_type,
      al.created_at as occurred_at,
      'Atividade reagendada' as title,
      null::text as description,
      al.actor_id as actor_user_id,
      'activity' as entity_type,
      null::uuid as entity_id,
      al.metadata as metadata
    from public.audit_logs al
    where al.action = 'crm.activity_rescheduled'
      and al.metadata ->> 'lead_id' = p_lead_id::text

    union all

    select
      a.id as event_id,
      'ACTIVITY_CANCELED' as event_type,
      a.updated_at as occurred_at,
      'Atividade cancelada' as title,
      a.title as description,
      a.updated_by as actor_user_id,
      'activity' as entity_type,
      a.id as entity_id,
      jsonb_build_object('type', a.type) as metadata
    from public.crm_activities a
    where a.lead_id = p_lead_id
      and a.status = 'CANCELED'
      and a.updated_at is not null

    union all

    select
      sh.id as event_id,
      'LEAD_LOST' as event_type,
      sh.changed_at as occurred_at,
      'Lead perdido' as title,
      sh.reason as description,
      sh.changed_by as actor_user_id,
      'lead' as entity_type,
      sh.lead_id as entity_id,
      sh.metadata as metadata
    from public.crm_lead_stage_history sh
    where sh.lead_id = p_lead_id
      and sh.reason = 'Lead perdido'
  ),
  enriched_events as (
    select
      ae.*,
      pr.full_name as actor_name
    from all_events ae
    left join public.profiles pr on pr.id = ae.actor_user_id
    order by ae.occurred_at desc
    limit p_page_size offset v_offset
  )
  select coalesce(json_agg(
    json_build_object(
      'id', ee.event_id,
      'event_type', ee.event_type,
      'occurred_at', to_char(ee.occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'title', ee.title,
      'description', ee.description,
      'actor_user_id', ee.actor_user_id,
      'actor_name', ee.actor_name,
      'entity_type', ee.entity_type,
      'entity_id', ee.entity_id,
      'metadata', ee.metadata
    )
  ), '[]'::json)
  into v_rows
  from enriched_events ee;

  return json_build_object(
    'data', v_rows,
    'total', v_total,
    'page', greatest(p_page, 1),
    'page_size', greatest(p_page_size, 1)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. list_crm_lead_activities() — atividades paginadas de um lead
-- ---------------------------------------------------------------------------
create or replace function public.list_crm_lead_activities(
  p_lead_id uuid,
  p_page integer default 1,
  p_page_size integer default 50,
  p_status text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_user_id uuid;
  v_exists boolean;
  v_has_view_all boolean;
  v_offset integer;
  v_total bigint;
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('PENDING', 'COMPLETED', 'CANCELED') then
    raise exception 'Invalid activity status' using errcode = '22023';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  -- Verificar existência do lead
  select exists(select 1 from public.crm_leads where id = p_lead_id)
  into v_exists;

  if not v_exists then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  -- Ownership check (mesma lógica do get_crm_lead_detail)
  select owner_user_id into v_owner_user_id from public.crm_leads where id = p_lead_id;

  if v_owner_user_id is distinct from auth.uid() and not v_has_view_all then
    raise exception 'Not authorized to view this lead' using errcode = '42501';
  end if;

  -- Contagem total
  select count(*)::bigint into v_total
  from public.crm_activities a
  where a.lead_id = p_lead_id
    and a.status in ('PENDING', 'COMPLETED', 'CANCELED')
    and (p_status is null or a.status = p_status);

  -- Montagem paginada
  select coalesce(json_agg(act), '[]'::json)
  into v_rows
  from (
    select
      a.id,
      a.lead_id,
      a.type,
      a.title,
      a.description,
      to_char(a.due_at, 'YYYY-MM-DD"T"HH24:MI:SS') as due_at,
      a.status,
      to_char(a.completed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as completed_at,
      to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as created_at,
      to_char(a.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as updated_at,
      a.outcome,
      pr.full_name as owner_name,
      a.owner_user_id,
      (a.status = 'PENDING' and a.due_at < now()) as is_overdue
    from public.crm_activities a
    left join public.profiles pr on pr.id = a.owner_user_id
    where a.lead_id = p_lead_id
      and a.status in ('PENDING', 'COMPLETED', 'CANCELED')
      and (p_status is null or a.status = p_status)
    order by a.due_at desc
    limit p_page_size offset v_offset
  ) act;

  return json_build_object(
    'data', v_rows,
    'total', v_total,
    'page', greatest(p_page, 1),
    'page_size', greatest(p_page_size, 1)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. GRANTS — execução controlada para authenticated, revogar public/anon
-- ---------------------------------------------------------------------------

-- list_crm_pipeline_stages
revoke execute on function public.list_crm_pipeline_stages() from public, anon;
grant execute on function public.list_crm_pipeline_stages() to authenticated;

-- get_crm_lead_timeline
revoke execute on function public.get_crm_lead_timeline(uuid, integer, integer) from public, anon;
grant execute on function public.get_crm_lead_timeline(uuid, integer, integer) to authenticated;

-- list_crm_lead_activities
revoke execute on function public.list_crm_lead_activities(uuid, integer, integer, text) from public, anon;
grant execute on function public.list_crm_lead_activities(uuid, integer, integer, text) to authenticated;

-- create_crm_lead: a assinatura antiga foi DROPada acima (grants morrem com ela);
-- conceder/revogar apenas na assinatura nova
grant execute on function public.create_crm_lead(text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz) to authenticated;
revoke execute on function public.create_crm_lead(text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz) from public, anon;

-- update_crm_lead: idem
grant execute on function public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric,uuid) to authenticated;
revoke execute on function public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric,uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- 8. NOTIFY pgrst — reload do schema cache
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';

commit;
