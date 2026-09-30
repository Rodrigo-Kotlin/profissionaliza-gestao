-- ============================================================================
-- CORREÇÃO FINAL PÓS-E2E (PR #14) — CONVERGÊNCIA DE AMBIENTES
-- ============================================================================
-- Esta migration é a RECONCILIAÇÃO OFICIAL de dois problemas encontrados na
-- validação E2E em DEV (2026-09-13). É aditiva e convergente: qualquer
-- ambiente — com a versão antiga OU nova da migration 20260912100000 — termina
-- no MESMO estado após aplicá-la.
--
-- 1. DRIFT de migration 20260912100000 (create_crm_lead v2):
--    No DEV, a migration foi registrada no schema_migrations com o conteúdo
--    da época b355657, enquanto o repositório avançou para 8a9626a. O drift
--    foi contornado temporariamente com um script manual de sync. Aqui o
--    conteúdo FINAL é reaplicado via migration versionada — sem alterar
--    histórico, sem editar a 20260912100000 e sem tocar em schema_migrations.
--    Objetos reafirmados (CREATE OR REPLACE):
--      * _crm_name_matches(text,text)     — helper interno (nome NUNCA é chave)
--      * create_crm_lead v2 (15 params)   — política anti People errada
--    E limpeza: _crm_name_overlap (helper antigo, pré-repositório) é DROP.
--
-- 2. BUG de CEP com zeros à esquerda (IDENTIDADE / ENDEREÇO):
--    create_person e create_student aplicavam ltrim(coalesce(p_postal_code,''),
--    '0'), removendo o primeiro zero de CEPs com prefixo 0 (ex.: 01001-000
--    virava 1001000 — 7 dígitos -> violava a CHECK ^[0-9]{8}$ e quebrava o
--    cadastro). Correção: normalização = remover NÃO-dígitos e preservar TODOS
--    os dígitos (inclusive zeros à esquerda), NULLIF para strings vazias e
--    validação explícita de 8 dígitos quando o CEP é informado. update_person e
--    update_student já preservavam zeros (regexp_replace), mas agora validam
--    explicitamente 8 dígitos para comportamento uniforme e erro claro (22023).
--
-- Regra de CEP (todas as portas de entrada):
--   '01001-000'  -> '01001000'   (nunca '1001000')
--   '01310-100'  -> '01310100'
--   '68000-000'  -> '68000000'
--   '' ou nulo   -> NULL         (sem CEP)
--   '12345'      -> erro 22023 'Postal code must have 8 digits'
--
-- Segurança preservada em todas as funções: auth.uid() obrigatório, permissões,
-- SECURITY DEFINER, search_path = pg_catalog, public, row_security = off,
-- grants/revokes explícitos e auditoria server-side sem PII.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. _crm_name_matches — definição FINAL (reafirmada; CREATE OR REPLACE)
--    Compatível: igualdade após normalizar e ignorar conectivos.
--    Nome NUNCA resolve identidade: é apenas sinal contextual de revisão.
-- ---------------------------------------------------------------------------
create or replace function public._crm_name_matches(p_name_a text, p_name_b text)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_stopwords text[] := array['de', 'da', 'do', 'dos', 'das', 'e'];
  v_tokens_a text[];
  v_tokens_b text[];
  v_clean_a text[] := '{}'::text[];
  v_clean_b text[] := '{}'::text[];
  v_t text;
begin
  if p_name_a is null or p_name_b is null then
    return false;
  end if;
  v_tokens_a := regexp_split_to_array(lower(trim(regexp_replace(p_name_a, '\s+', ' ', 'g'))), ' ');
  v_tokens_b := regexp_split_to_array(lower(trim(regexp_replace(p_name_b, '\s+', ' ', 'g'))), ' ');
  foreach v_t in array v_tokens_a loop
    if v_t <> '' and not (v_t = any(v_stopwords)) then
      v_clean_a := array_append(v_clean_a, v_t);
    end if;
  end loop;
  foreach v_t in array v_tokens_b loop
    if v_t <> '' and not (v_t = any(v_stopwords)) then
      v_clean_b := array_append(v_clean_b, v_t);
    end if;
  end loop;
  return v_clean_a = v_clean_b;
end;
$$;

revoke all on function public._crm_name_matches(text, text) from public, anon;

-- ---------------------------------------------------------------------------
-- 2. _crm_name_overlap — helper antigo (pré-repositório) deve ser removido
--    (qualquer assinatura) caso ainda exista em algum ambiente.
-- ---------------------------------------------------------------------------
do $$
declare
  v_reg record;
begin
  for v_reg in
    select oid::regprocedure::text as sig
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname = '_crm_name_overlap'
  loop
    execute format('drop function %s', v_reg.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. create_crm_lead v2 — remoção das assinaturas antigas (13/12 params e a v1
--    com 14 params que adicionou p_cpf). Nenhuma lógica antiga permanece.
-- ---------------------------------------------------------------------------
drop function if exists public.create_crm_lead(
  text, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text, timestamptz
);
drop function if exists public.create_crm_lead(
  text, text, text, text, text, uuid, uuid, uuid, text, text, text, text, timestamptz
);
drop function if exists public.create_crm_lead(
  text, text, text, text, text, uuid, uuid, text, text, text, text, timestamptz
);

-- ---------------------------------------------------------------------------
-- 4. create_crm_lead v2 FINAL (15 params) — política anti People errada.
--    CPF exato reutiliza; contatos e nome NUNCA reutilizam automaticamente.
--    Estados: new_person | cpf_exact | cpf_exact_forced | contact_conflict |
--    contact_conflict_forced | cpf_exact_name_mismatch (erro LEAD_NAME_MISMATCH).
-- ---------------------------------------------------------------------------
create or replace function public.create_crm_lead(
  p_full_name text,
  p_phone text default null,
  p_whatsapp text default null,
  p_email text default null,
  p_cpf text default null,
  p_source_code text default 'OUTRO',
  p_course_interest_id uuid default null,
  p_owner_user_id uuid default null,
  p_stage_id uuid default null,
  p_temperature text default null,
  p_commercial_notes text default null,
  p_first_activity_title text default null,
  p_first_activity_type text default 'OTHER',
  p_first_activity_due_at timestamptz default null,
  p_force_create boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person_id uuid;
  v_existing_full_name text;
  v_lead_id uuid;
  v_lead_code text;
  v_stage_id uuid;
  v_source_id uuid;
  v_owner uuid;
  v_normalized_phone text;
  v_normalized_whatsapp text;
  v_normalized_email text;
  v_normalized_cpf text;
  v_identity_resolution text := 'new_person';
  v_conflict_fields text[] := '{}'::text[];
  v_identity_metadata jsonb;
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
  if not exists (select 1 from public.profiles where id = v_owner and is_active) then
    raise exception 'Invalid owner user' using errcode = '22023';
  end if;

  -- Normalizações
  v_normalized_phone := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_normalized_whatsapp := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_normalized_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');

  -- Validação do CPF quando informado: exatamente 11 dígitos
  if v_normalized_cpf is not null and char_length(v_normalized_cpf) <> 11 then
    raise exception 'Invalid CPF: must contain 11 digits' using errcode = '22023';
  end if;

  -- Busca source
  select id into v_source_id from public.crm_lead_sources where code = p_source_code limit 1;

  -- Resolução da stage inicial
  if p_stage_id is not null then
    v_stage_id := public._crm_validate_stage_move(p_stage_id, p_course_interest_id);

    if (select code from public.crm_pipeline_stages where id = v_stage_id) <> 'NEW_LEAD' then
      if not public.has_permission('crm.move_stage') then
        raise exception 'Permission denied: crm.move_stage (required for non-NEW_LEAD initial stage)' using errcode = '42501';
      end if;
    end if;
  else
    select id into v_stage_id from public.crm_pipeline_stages where code = 'NEW_LEAD';
  end if;

  -- -------------------------------------------------------------------------
  -- RESOLUÇÃO DE IDENTIDADE (regra v2)
  --  CPF exato reutiliza. Contato NUNCA reutiliza sem confirmação explícita.
  -- -------------------------------------------------------------------------
  if v_normalized_cpf is not null then
    select id, full_name into v_person_id, v_existing_full_name
    from public.people
    where cpf = v_normalized_cpf
    limit 1;

    if v_person_id is not null then
      v_identity_resolution := 'cpf_exact';
      if not public._crm_name_matches(p_full_name, v_existing_full_name) then
        v_identity_resolution := 'cpf_exact_name_mismatch';
        if p_force_create then
          v_identity_resolution := 'cpf_exact_forced';
        else
          perform public.write_audit_log(
            'crm.lead_identity_conflict', 'crm_lead', null,
            jsonb_build_object(
              'identity_resolution', v_identity_resolution,
              'identity_conflict', 'cpf_name_mismatch'
            )
          );
          raise exception 'LEAD_NAME_MISMATCH'
            using errcode = 'P0001';
        end if;
      end if;
    end if;
  end if;

  -- Passo 4: CPF ausente (ou sem match) => NUNCA reutilizar por contato.
  if v_person_id is null and v_normalized_cpf is null then
    if v_normalized_phone is not null
       and exists (select 1 from public.people where phone = v_normalized_phone limit 1) then
      v_conflict_fields := array_append(v_conflict_fields, 'phone');
    end if;
    if v_normalized_whatsapp is not null
       and exists (select 1 from public.people where whatsapp = v_normalized_whatsapp limit 1) then
      v_conflict_fields := array_append(v_conflict_fields, 'whatsapp');
    end if;
    if v_normalized_email is not null
       and exists (select 1 from public.people where lower(email) = v_normalized_email limit 1) then
      v_conflict_fields := array_append(v_conflict_fields, 'email');
    end if;

    if array_length(v_conflict_fields, 1) > 0 then
      if p_force_create then
        v_identity_resolution := 'contact_conflict_forced';
      else
        v_identity_resolution := 'contact_conflict';
      end if;
    end if;
  end if;

  -- Passo 5: conflito controlado (erro de negócio sem PII). CPF nunca é
  -- POSSIBLE_DUPLICATE e nome nunca é campo de deduplicação.
  if v_identity_resolution = 'contact_conflict' then
    perform public.write_audit_log(
      'crm.lead_identity_conflict', 'crm_lead', null,
      jsonb_build_object(
        'identity_resolution', v_identity_resolution,
        'identity_conflict_fields', to_jsonb(v_conflict_fields)
      )
    );
    raise exception 'POSSIBLE_DUPLICATE:%', array_to_string(v_conflict_fields, ',')
      using errcode = 'P0001';
  end if;

  -- Passo 6: cria nova People apenas quando seguro
  if v_person_id is null then
    insert into public.people (
      full_name, cpf, phone, whatsapp, email, created_by, updated_by
    ) values (
      trim(p_full_name), v_normalized_cpf, v_normalized_phone, v_normalized_whatsapp, v_normalized_email,
      auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  -- Gera código do lead (concorrente-seguro via sequence)
  v_lead_code := 'LEAD-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.lead_code_seq')::text, 6, '0');

  -- Passo 7: cria lead apontando para a People correta
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

  -- Auditoria (segura, sem PII de identidade)
  v_identity_metadata := jsonb_build_object(
    'lead_code', v_lead_code,
    'person_id', v_person_id::text,
    'source', p_source_code,
    'stage_id', v_stage_id::text,
    'initial_stage', (select code from public.crm_pipeline_stages where id = v_stage_id),
    'identity_resolution', v_identity_resolution
  );
  if array_length(v_conflict_fields, 1) > 0 then
    v_identity_metadata := v_identity_metadata
      || jsonb_build_object('identity_conflict_fields', to_jsonb(v_conflict_fields));
  end if;

  perform public.write_audit_log(
    'crm.lead_created', 'crm_lead', v_lead_id::text, v_identity_metadata
  );

  return v_lead_id;
end;
$$;

GRANT EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz,boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz,boolean) FROM public, anon;

-- ---------------------------------------------------------------------------
-- 5. create_person FINAL — CEP com zeros à esquerda preservados
-- ---------------------------------------------------------------------------
create or replace function public.create_person(
  p_full_name text,
  p_preferred_name text default null,
  p_cpf text default null,
  p_rg text default null,
  p_birth_date date default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_postal_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person_id uuid;
  v_reused boolean := false;
  v_normalized_cpf text;
  v_normalized_email text;
  v_normalized_postal text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('people.create') then
    raise exception 'Permission denied: people.create' using errcode = '42501';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;

  v_normalized_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  if v_normalized_cpf is not null and char_length(v_normalized_cpf) <> 11 then
    raise exception 'CPF must have 11 digits' using errcode = '22023';
  end if;

  -- CEP: remove apenas não-dígitos, PRESERVA zeros à esquerda, NULLIF vazio apaga.
  -- Nunca ltrim(...,'0'): '01001000' deve permanecer 8 dígitos.
  v_normalized_postal := nullif(regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g'), '');
  if v_normalized_postal is not null and char_length(v_normalized_postal) <> 8 then
    raise exception 'Postal code must have 8 digits' using errcode = '22023';
  end if;

  -- Reutilização: apenas match exato de CPF. Nunca por nome/telefone/email.
  if v_normalized_cpf is not null then
    select id into v_person_id
    from public.people
    where cpf = v_normalized_cpf;
    v_reused := v_person_id is not null;
  end if;

  if v_person_id is null then
    insert into public.people (
      full_name, preferred_name, cpf, rg, birth_date, email, phone, whatsapp,
      postal_code, street, number, complement, district, city, state,
      emergency_contact_name, emergency_contact_phone, notes, created_by, updated_by
    ) values (
      trim(p_full_name), nullif(trim(coalesce(p_preferred_name, '')), ''), v_normalized_cpf,
      nullif(trim(coalesce(p_rg, '')), ''), p_birth_date, v_normalized_email,
      nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
      nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
      v_normalized_postal,
      nullif(trim(coalesce(p_street, '')), ''), nullif(trim(coalesce(p_number, '')), ''),
      nullif(trim(coalesce(p_complement, '')), ''), nullif(trim(coalesce(p_district, '')), ''),
      nullif(trim(coalesce(p_city, '')), ''), nullif(upper(trim(coalesce(p_state, ''))), ''),
      nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
      nullif(regexp_replace(coalesce(p_emergency_contact_phone, ''), '\D', '', 'g'), ''),
      nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  if v_reused then
    perform public.write_audit_log(
      'people.reused', 'person', v_person_id::text,
      jsonb_build_object('reused', true)
    );
  else
    perform public.write_audit_log(
      'people.created', 'person', v_person_id::text,
      jsonb_build_object('reused', false)
    );
  end if;

  return json_build_object('person_id', v_person_id, 'reused', v_reused);
end;
$$;

revoke execute on function public.create_person(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_person(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. update_person FINAL — validação explícita de 8 dígitos para o CEP
--    (já preservava zeros via regexp_replace; agora erro claro 22023).
--    Semântica preservada: p_postal_code NULL mantém o valor existente.
-- ---------------------------------------------------------------------------
create or replace function public.update_person(
  p_person_id                 uuid,
  p_full_name                 text default null,
  p_preferred_name            text default null,
  p_birth_date                date default null,
  p_email                     text default null,
  p_phone                     text default null,
  p_whatsapp                  text default null,
  p_postal_code               text default null,
  p_street                    text default null,
  p_number                    text default null,
  p_complement                text default null,
  p_district                  text default null,
  p_city                      text default null,
  p_state                     text default null,
  p_emergency_contact_name    text default null,
  p_emergency_contact_phone   text default null,
  p_notes                     text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sensitive     boolean;
  v_normalized_postal text;
  v_updated_epoch timestamptz;
  v_person record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('people.edit') then
    raise exception 'Permission denied: people.edit' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('contracts.view_sensitive') or public.has_permission('students.view_sensitive');

  select * into v_person from public.people where id = p_person_id for update;
  if v_person is null then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;

  if p_full_name is not null and p_full_name <> '' and char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name cannot be empty' using errcode = '22023';
  end if;

  -- CEP: remove não-dígitos preservando zeros à esquerda; valida 8 dígitos.
  if v_sensitive and p_postal_code is not null then
    v_normalized_postal := nullif(regexp_replace(p_postal_code, '\D', '', 'g'), '');
  end if;
  if p_postal_code is not null and v_normalized_postal is not null and char_length(v_normalized_postal) <> 8 then
    raise exception 'Postal code must have 8 digits' using errcode = '22023';
  end if;

  update public.people set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    preferred_name = case when p_preferred_name is null then preferred_name else nullif(trim(p_preferred_name), '') end,
    birth_date = coalesce(p_birth_date, birth_date),
    email = case
      when not v_sensitive or p_email is null then email
      else nullif(lower(trim(p_email)), '')
    end,
    phone = case
      when not v_sensitive or p_phone is null then phone
      else nullif(regexp_replace(p_phone, '\D', '', 'g'), '')
    end,
    whatsapp = case
      when not v_sensitive or p_whatsapp is null then whatsapp
      else nullif(regexp_replace(p_whatsapp, '\D', '', 'g'), '')
    end,
    postal_code = case
      when not v_sensitive or p_postal_code is null then postal_code
      else v_normalized_postal
    end,
    street = case
      when not v_sensitive or p_street is null then street
      else nullif(trim(p_street), '')
    end,
    number = case
      when not v_sensitive or p_number is null then number
      else nullif(trim(p_number), '')
    end,
    complement = case
      when not v_sensitive or p_complement is null then complement
      else nullif(trim(p_complement), '')
    end,
    district = case
      when not v_sensitive or p_district is null then district
      else nullif(trim(p_district), '')
    end,
    city = case
      when not v_sensitive or p_city is null then city
      else nullif(trim(p_city), '')
    end,
    state = case
      when not v_sensitive or p_state is null then state
      else nullif(upper(trim(p_state)), '')
    end,
    emergency_contact_name = case
      when not v_sensitive or p_emergency_contact_name is null then emergency_contact_name
      else nullif(trim(p_emergency_contact_name), '')
    end,
    emergency_contact_phone = case
      when not v_sensitive or p_emergency_contact_phone is null then emergency_contact_phone
      else nullif(regexp_replace(p_emergency_contact_phone, '\D', '', 'g'), '')
    end,
    notes = case when p_notes is null then notes else nullif(trim(p_notes), '') end,
    updated_by = auth.uid()
  where id = p_person_id;

  perform public.write_audit_log(
    'people.updated', 'person', p_person_id::text,
    jsonb_build_object('fields', (
      select coalesce(jsonb_agg(k), '[]'::jsonb)
      from unnest(
        case when p_full_name is not null then array['full_name'] else '{}'::text[] end ||
        case when p_preferred_name is not null then array['preferred_name'] else '{}'::text[] end ||
        case when p_birth_date is not null then array['birth_date'] else '{}'::text[] end ||
        case when p_email is not null then array['email'] else '{}'::text[] end ||
        case when p_phone is not null then array['phone'] else '{}'::text[] end ||
        case when p_whatsapp is not null then array['whatsapp'] else '{}'::text[] end ||
        case when p_postal_code is not null then array['postal_code'] else '{}'::text[] end ||
        case when p_street is not null then array['street'] else '{}'::text[] end ||
        case when p_number is not null then array['number'] else '{}'::text[] end ||
        case when p_complement is not null then array['complement'] else '{}'::text[] end ||
        case when p_district is not null then array['district'] else '{}'::text[] end ||
        case when p_city is not null then array['city'] else '{}'::text[] end ||
        case when p_state is not null then array['state'] else '{}'::text[] end ||
        case when p_emergency_contact_name is not null then array['emergency_contact_name'] else '{}'::text[] end ||
        case when p_emergency_contact_phone is not null then array['emergency_contact_phone'] else '{}'::text[] end ||
        case when p_notes is not null then array['notes'] else '{}'::text[] end
      ) as k
    ))
  );

  return json_build_object('person_id', p_person_id, 'updated', true);
end;
$$;

revoke execute on function public.update_person(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.update_person(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. create_student FINAL — CEP com zeros à esquerda preservados
-- ---------------------------------------------------------------------------
create or replace function public.create_student(
  p_full_name text,
  p_preferred_name text default null,
  p_cpf text default null,
  p_rg text default null,
  p_birth_date date default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_postal_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_notes text default null,
  p_origin text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person_id uuid;
  v_student_id uuid;
  v_student_code text;
  v_normalized_cpf text;
  v_normalized_email text;
  v_normalized_postal text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.create') then
    raise exception 'Permission denied: students.create' using errcode = '42501';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;

  -- Normalizações
  v_normalized_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  if v_normalized_cpf is not null and char_length(v_normalized_cpf) <> 11 then
    raise exception 'CPF must have 11 digits' using errcode = '22023';
  end if;

  -- CEP: remove apenas não-dígitos, PRESERVA zeros à esquerda, NULLIF vazio apaga.
  v_normalized_postal := nullif(regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g'), '');
  if v_normalized_postal is not null and char_length(v_normalized_postal) <> 8 then
    raise exception 'Postal code must have 8 digits' using errcode = '22023';
  end if;

  -- Reutiliza people quando CPF já existe; caso contrário cria nova.
  if v_normalized_cpf is not null then
    select id into v_person_id
    from public.people
    where cpf = v_normalized_cpf;
  end if;

  if v_person_id is null then
    insert into public.people (
      full_name, preferred_name, cpf, rg, birth_date, email, phone, whatsapp,
      postal_code, street, number, complement, district, city, state,
      emergency_contact_name, emergency_contact_phone, notes, created_by, updated_by
    ) values (
      trim(p_full_name), nullif(trim(coalesce(p_preferred_name, '')), ''), v_normalized_cpf,
      nullif(trim(coalesce(p_rg, '')), ''), p_birth_date, v_normalized_email,
      nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
      nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
      v_normalized_postal, nullif(trim(coalesce(p_street, '')), ''),
      nullif(trim(coalesce(p_number, '')), ''), nullif(trim(coalesce(p_complement, '')), ''),
      nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_city, '')), ''),
      nullif(upper(trim(coalesce(p_state, ''))), ''), nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
      nullif(regexp_replace(coalesce(p_emergency_contact_phone, ''), '\D', '', 'g'), ''),
      nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  -- Gera código de aluno (concorrente-seguro via sequence)
  v_student_code := 'ALU-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.student_code_seq')::text, 6, '0');

  insert into public.students (
    person_id, student_code, status, registration_date, origin, notes, created_by, updated_by
  ) values (
    v_person_id, v_student_code, 'PRE_CADASTRO', current_date,
    nullif(trim(coalesce(p_origin, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid()
  )
  returning id into v_student_id;

  -- Histórico inicial
  insert into public.student_status_history (student_id, previous_status, new_status, reason, changed_by)
  values (v_student_id, null, 'PRE_CADASTRO', 'Criação do aluno', auth.uid());

  perform public.write_audit_log(
    'student.created', 'student', v_student_id::text,
    jsonb_build_object('person_id', v_person_id::text, 'code', v_student_code)
  );

  return v_student_id;
end;
$$;

grant execute on function public.create_student(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
revoke execute on function public.create_student(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;

-- ---------------------------------------------------------------------------
-- 8. update_student FINAL — validação explícita de 8 dígitos para o CEP
--    (já preservava zeros via regexp_replace; agora erro claro 22023).
--    Semântica preservada: CEP é sobrescrito pelo argumento (null apaga).
-- ---------------------------------------------------------------------------
create or replace function public.update_student(
  p_student_id uuid,
  p_full_name text,
  p_preferred_name text default null,
  p_birth_date date default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_postal_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_notes text default null,
  p_origin text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sensitive boolean;
  v_normalized_postal text;
  v_person_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.edit') then
    raise exception 'Permission denied: students.edit' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('students.view_sensitive');

  select person_id into v_person_id from public.students where id = p_student_id for update;
  if v_person_id is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;

  -- CEP: remove não-dígitos preservando zeros à esquerda; valida 8 dígitos.
  if v_sensitive then
    v_normalized_postal := nullif(regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g'), '');
  end if;
  if v_normalized_postal is not null and char_length(v_normalized_postal) <> 8 then
    raise exception 'Postal code must have 8 digits' using errcode = '22023';
  end if;

  update public.people
     set full_name = trim(p_full_name),
         preferred_name = nullif(trim(coalesce(p_preferred_name, '')), ''),
         birth_date = p_birth_date,
         email = case when v_sensitive then nullif(lower(trim(coalesce(p_email, ''))), '') else email end,
         phone = case when v_sensitive then nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') else phone end,
         whatsapp = case when v_sensitive then nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '') else whatsapp end,
         postal_code = case when v_sensitive then v_normalized_postal else postal_code end,
         street = case when v_sensitive then nullif(trim(coalesce(p_street, '')), '') else street end,
         number = case when v_sensitive then nullif(trim(coalesce(p_number, '')), '') else number end,
         complement = case when v_sensitive then nullif(trim(coalesce(p_complement, '')), '') else complement end,
         district = case when v_sensitive then nullif(trim(coalesce(p_district, '')), '') else district end,
         city = case when v_sensitive then nullif(trim(coalesce(p_city, '')), '') else city end,
         state = case when v_sensitive then nullif(upper(trim(coalesce(p_state, ''))), '') else state end,
         emergency_contact_name = case when v_sensitive then nullif(trim(coalesce(p_emergency_contact_name, '')), '') else emergency_contact_name end,
         emergency_contact_phone = case when v_sensitive then nullif(regexp_replace(coalesce(p_emergency_contact_phone, ''), '\D', '', 'g'), '') else emergency_contact_phone end,
         updated_by = auth.uid()
   where id = v_person_id;

  update public.students
     set notes = nullif(trim(coalesce(p_notes, '')), ''),
         origin = nullif(trim(coalesce(p_origin, '')), ''),
         updated_by = auth.uid()
   where id = p_student_id;

  perform public.write_audit_log(
    'student.updated', 'student', p_student_id::text,
    jsonb_build_object('person_id', v_person_id::text)
  );
end;
$$;

grant execute on function public.update_student(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
revoke execute on function public.update_student(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;

commit;