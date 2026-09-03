-- ============================================================================
-- FASE 2.2 HOTFIX — CORREÇÕES DE RUNTIME DAS RPCs CRM
-- ============================================================================
-- Causa raiz: migration original foi validada por lint/typecheck/test mas
-- continha erros de schema que só aparecem em runtime contra PostgreSQL real:
--   1. crm_leads.notes não existe (schema real: commercial_notes)
--   2. uuid(nil) não existe em PostgreSQL
--   3. Variável v_course_interest_id não declarada
--   4. Mapeamento source_id/course_interest_id trocado no INSERT
--   5. json_agg com alias "row" (keyword reservada)
--   6. json_agg referenciando alias de subquery fora de escopo
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. create_crm_lead — DROP + CREATE com correções
-- ---------------------------------------------------------------------------
-- Assinatura antiga (com p_notes) — DROP controlado
DROP FUNCTION IF EXISTS public.create_crm_lead(
  text, text, text, text, text, uuid, uuid, text, text, text, text, timestamptz
);

CREATE OR REPLACE FUNCTION public.create_crm_lead(
  p_full_name text,
  p_phone text default null,
  p_whatsapp text default null,
  p_email text default null,
  p_source_code text default 'OUTRO',
  p_course_interest_id uuid default null,
  p_owner_user_id uuid default null,
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

  -- Busca stage inicial (NEW_LEAD)
  select id into v_stage_id from public.crm_pipeline_stages where code = 'NEW_LEAD';

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

  -- Cria lead — CORREÇÃO: source_id = v_source_id, course_interest_id = p_course_interest_id
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

  -- Histórico inicial
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
    jsonb_build_object('lead_code', v_lead_code, 'person_id', v_person_id::text, 'source', p_source_code)
  );

  return v_lead_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. update_crm_lead — DROP + CREATE sem referência a notes
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_crm_lead(
  uuid, uuid, uuid, text, text, text, text, text, text, text, text, numeric, numeric, text
);

CREATE OR REPLACE FUNCTION public.update_crm_lead(
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
  p_proposed_value numeric default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead record;
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
    updated_by = auth.uid()
  where id = p_lead_id;

  perform public.write_audit_log(
    'crm.lead_updated', 'crm_lead', p_lead_id::text,
    jsonb_build_object('lead_code', v_lead.lead_code)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. get_crm_lead_detail — remover referência a notes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_crm_lead_detail(p_lead_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead json;
  v_next_activity json;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  select json_build_object(
    'id', l.id,
    'lead_code', l.lead_code,
    'person_id', l.person_id,
    'full_name', p.full_name,
    'phone', p.phone,
    'whatsapp', p.whatsapp,
    'email', p.email,
    'stage_id', l.stage_id,
    'stage_code', s.code,
    'stage_name', s.name,
    'source_id', l.source_id,
    'source_name', sr.name,
    'course_interest_id', l.course_interest_id,
    'course_name', c.name,
    'owner_user_id', l.owner_user_id,
    'owner_name', pr.full_name,
    'status', l.status,
    'temperature', l.temperature,
    'qualification_start_period', l.qualification_start_period,
    'preferred_shift', l.preferred_shift,
    'preferred_modality', l.preferred_modality,
    'budget_notes', l.budget_notes,
    'decision_maker', l.decision_maker,
    'source_detail', l.source_detail,
    'utm_source', l.utm_source,
    'utm_medium', l.utm_medium,
    'utm_campaign', l.utm_campaign,
    'estimated_value', l.estimated_value,
    'proposed_value', l.proposed_value,
    'proposal_sent_at', l.proposal_sent_at,
    'commercial_notes', l.commercial_notes,
    'lost_reason_id', l.lost_reason_id,
    'lost_reason_name', lr.name,
    'lost_notes', l.lost_notes,
    'created_at', to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'updated_at', to_char(l.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'closed_at', l.closed_at,
    'days_in_pipeline', extract(day from now() - l.created_at)::integer
  )
  into v_lead
  from public.crm_leads l
  join public.people p on p.id = l.person_id
  join public.crm_pipeline_stages s on s.id = l.stage_id
  left join public.crm_lead_sources sr on sr.id = l.source_id
  left join public.courses c on c.id = l.course_interest_id
  left join public.profiles pr on pr.id = l.owner_user_id
  left join public.crm_lost_reasons lr on lr.id = l.lost_reason_id
  where l.id = p_lead_id;

  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  -- Próxima atividade
  select json_build_object(
    'id', a.id,
    'type', a.type,
    'title', a.title,
    'due_at', to_char(a.due_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'status', a.status,
    'is_overdue', a.due_at < now()
  )
  into v_next_activity
  from public.crm_activities a
  where a.lead_id = p_lead_id and a.status = 'PENDING'
  order by a.due_at asc
  limit 1;

  v_result := v_lead || json_build_object('next_activity', v_next_activity);

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. list_crm_pipeline — fix json_agg scoping
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_crm_pipeline(
  p_owner_user_id uuid default null,
  p_limit integer default 50
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_columns json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');

  select coalesce(json_agg(col order by st.position), '[]'::json)
  into v_columns
  from (
    select
      st.id as stage_id,
      st.code as stage_code,
      st.name as stage_name,
      st.position,
      (select count(*)::int from public.crm_leads l
        where l.stage_id = st.id
          and l.status = 'OPEN'
          and (v_has_view_all or l.owner_user_id = auth.uid())
          and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
      ) as total_count
    from public.crm_pipeline_stages st
    where st.is_active
    order by st.position
  ) st
  cross join lateral (
    select json_build_object(
      'stage_id', st.stage_id,
      'stage_code', st.stage_code,
      'stage_name', st.stage_name,
      'position', st.position,
      'total_count', st.total_count,
      'leads', coalesce((
        select json_agg(card order by card.created_at)
        from (
          select
            l.id,
            l.lead_code,
            p.full_name,
            c.name as course_name,
            l.temperature,
            pr.full_name as owner_name,
            l.owner_user_id,
            l.created_at,
            l.updated_at,
            extract(day from now() - l.created_at)::int as days_in_stage,
            (select count(*)::int from public.crm_activities a
              where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
            ) as overdue_activities,
            (select count(*)::int from public.crm_activities a
              where a.lead_id = l.id and a.status = 'PENDING'
            ) as pending_activities
          from public.crm_leads l
          join public.people p on p.id = l.person_id
          left join public.courses c on c.id = l.course_interest_id
          left join public.profiles pr on pr.id = l.owner_user_id
          where l.stage_id = st.stage_id
            and l.status = 'OPEN'
            and (v_has_view_all or l.owner_user_id = auth.uid())
            and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
          order by l.created_at
          limit p_limit
        ) card
      ), '[]'::json)
    ) as col
  ) col;

  return json_build_object('columns', v_columns);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. search_crm_leads — fix json_agg reserved keyword
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_crm_leads(
  p_query text default null,
  p_stage_code text default null,
  p_owner_user_id uuid default null,
  p_source_id uuid default null,
  p_course_interest_id uuid default null,
  p_temperature text default null,
  p_status text default 'OPEN',
  p_overdue_only boolean default false,
  p_no_activity boolean default false,
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'created_at',
  p_sort_dir text default 'DESC'
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_offset integer;
  v_has_view_all boolean;
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

  if p_page_size > 100 then
    raise exception 'page_size cannot exceed 100' using errcode = '22023';
  end if;

  select count(*)::bigint into v_total
  from public.crm_leads l
  join public.people p on p.id = l.person_id
  join public.crm_pipeline_stages st on st.id = l.stage_id
  left join public.crm_lead_sources sr on sr.id = l.source_id
  left join public.courses c on c.id = l.course_interest_id
  where (p_status is null or l.status = p_status)
    and (p_stage_code is null or st.code = p_stage_code)
    and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
    and (p_source_id is null or l.source_id = p_source_id)
    and (p_course_interest_id is null or l.course_interest_id = p_course_interest_id)
    and (p_temperature is null or l.temperature = p_temperature)
    and (v_has_view_all or l.owner_user_id = auth.uid())
    and (p_query is null or p_query = '' or
      l.lead_code ilike '%' || p_query || '%'
      or p.full_name ilike '%' || p_query || '%'
      or p.phone like p_query || '%'
      or p.whatsapp like p_query || '%'
    )
    and (not p_overdue_only or exists (
      select 1 from public.crm_activities a
      where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
    ))
    and (not p_no_activity or not exists (
      select 1 from public.crm_activities a
      where a.lead_id = l.id and a.status = 'PENDING'
    ));

  v_rows := coalesce(json_agg(r), '[]'::json)
  from (
    select
      l.id,
      l.lead_code,
      p.full_name,
      p.phone,
      p.whatsapp,
      st.code as stage_code,
      st.name as stage_name,
      sr.name as source_name,
      c.name as course_name,
      pr.full_name as owner_name,
      l.owner_user_id,
      l.temperature,
      l.status,
      l.created_at,
      l.updated_at,
      extract(day from now() - l.created_at)::int as days_in_pipeline,
      (select a.type || ': ' || a.title from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' order by a.due_at asc limit 1
      ) as next_activity_summary,
      (select a.due_at from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' order by a.due_at asc limit 1
      ) as next_activity_at,
      (select count(*)::int from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
      ) as overdue_count
    from public.crm_leads l
    join public.people p on p.id = l.person_id
    join public.crm_pipeline_stages st on st.id = l.stage_id
    left join public.crm_lead_sources sr on sr.id = l.source_id
    left join public.courses c on c.id = l.course_interest_id
    left join public.profiles pr on pr.id = l.owner_user_id
    where (p_status is null or l.status = p_status)
      and (p_stage_code is null or st.code = p_stage_code)
      and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
      and (p_source_id is null or l.source_id = p_source_id)
      and (p_course_interest_id is null or l.course_interest_id = p_course_interest_id)
      and (p_temperature is null or l.temperature = p_temperature)
      and (v_has_view_all or l.owner_user_id = auth.uid())
      and (p_query is null or p_query = '' or
        l.lead_code ilike '%' || p_query || '%'
        or p.full_name ilike '%' || p_query || '%'
        or p.phone like p_query || '%'
        or p.whatsapp like p_query || '%'
      )
      and (not p_overdue_only or exists (
        select 1 from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
      ))
      and (not p_no_activity or not exists (
        select 1 from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING'
      ))
    order by
      case when p_sort = 'lead_code' and upper(p_sort_dir) = 'DESC' then l.lead_code end desc,
      case when p_sort = 'lead_code' and upper(p_sort_dir) <> 'DESC' then l.lead_code end asc,
      case when p_sort = 'full_name' and upper(p_sort_dir) = 'DESC' then lower(p.full_name) end desc,
      case when p_sort = 'full_name' and upper(p_sort_dir) <> 'DESC' then lower(p.full_name) end asc,
      case when p_sort = 'stage' and upper(p_sort_dir) = 'DESC' then st.position end desc,
      case when p_sort = 'stage' and upper(p_sort_dir) <> 'DESC' then st.position end asc,
      case when upper(p_sort_dir) = 'DESC' then l.created_at end desc,
      case when upper(p_sort_dir) <> 'DESC' then l.created_at end asc
    limit p_page_size offset v_offset
  ) r;

  return json_build_object(
    'data', v_rows,
    'total', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. crm_activity_agenda — fix json_agg reserved keyword
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_activity_agenda(
  p_owner_user_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_offset integer;
  v_has_manage_all boolean;
  v_total bigint;
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_manage_all := public.has_permission('crm.activities.manage_all');
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  select count(*)::bigint into v_total
  from public.crm_activities a
  join public.crm_leads l on l.id = a.lead_id
  where a.status = 'PENDING'
    and (v_has_manage_all or a.owner_user_id = auth.uid())
    and (p_owner_user_id is null or a.owner_user_id = p_owner_user_id);

  v_rows := coalesce(json_agg(r), '[]'::json)
  from (
    select
      a.id,
      a.lead_id,
      l.lead_code,
      p.full_name as lead_name,
      a.type,
      a.title,
      a.description,
      a.due_at,
      a.status,
      pr.full_name as owner_name,
      a.owner_user_id,
      a.due_at < now() as is_overdue
    from public.crm_activities a
    join public.crm_leads l on l.id = a.lead_id
    join public.people p on p.id = l.person_id
    left join public.profiles pr on pr.id = a.owner_user_id
    where a.status = 'PENDING'
      and (v_has_manage_all or a.owner_user_id = auth.uid())
      and (p_owner_user_id is null or a.owner_user_id = p_owner_user_id)
    order by
      case when a.due_at < now() then 0 else 1 end,
      a.due_at asc
    limit p_page_size offset v_offset
  ) r;

  return json_build_object(
    'data', v_rows,
    'total', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. list_courses — fix json_agg reserved keyword
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_courses(
  p_status text default 'ACTIVE'
)
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

  if not public.has_permission('courses.view') then
    raise exception 'Permission denied: courses.view' using errcode = '42501';
  end if;

  v_rows := coalesce(json_agg(c order by c.name), '[]'::json)
  from (
    select
      c.id,
      c.code,
      c.name,
      c.short_name,
      c.category,
      c.modality,
      c.workload_hours,
      c.duration_value,
      c.duration_unit,
      c.default_price,
      c.status
    from public.courses c
    where (p_status is null or c.status = p_status)
    order by c.name
  ) c;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. GRANTS — atualizar assinaturas
-- ---------------------------------------------------------------------------
-- create_crm_lead: nova assinatura (p_commercial_notes em vez de p_notes)
-- NOTA: as funções já foram criadas nas seções 1 e 2. Apenas ajustamos grants.
GRANT EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,uuid,uuid,text,text,text,text,timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,uuid,uuid,text,text,text,text,timestamptz) FROM public, anon;

-- update_crm_lead: assinatura alterada (13 params — removido p_notes)
GRANT EXECUTE ON FUNCTION public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric) FROM public, anon;

-- demais RPCs: mantêm assinaturas, grants inalterados
-- (get_crm_lead_detail, list_crm_pipeline, search_crm_leads, move_crm_lead_stage,
--  assign_crm_lead, close_crm_lead_lost, create_crm_activity, complete_crm_activity,
--  reschedule_crm_activity, crm_dashboard_kpis, crm_activity_agenda,
--  list_courses, create_course, update_course)

commit;
