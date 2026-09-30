-- ---------------------------------------------------------------------------
-- create_crm_lead — v2: segurança de identidade (política anti People errada)
--
-- Motivação (BUG CRÍTICO PR #14):
--   A versão v1 deduplicava por telefone/WhatsApp/e-mail quando não havia CPF,
--   reutilizando silenciosamente um person_id de outra pessoa. Somado a um
--   rascunho (crm:lead-draft:v1) que podia manter campos antigos da sessão
--   anterior, leads eram vinculados à identidade errada.
--
-- Nova política (a partir desta correção):
--   1. CPF exato  -> chave forte de identidade: reutiliza People automaticamente
--      quando o nome informado é compatível com o cadastro existente.
--   2. Telefone/WhatsApp/e-mail -> NUNCA reutilizam automaticamente.
--      Indicadores de possível duplicidade => erro de negócio POSSIBLE_DUPLICATE
--      (sem PII) para revisão manual explícita.
--   3. Nome -> NUNCA é chave de resolução de identidade. É usado apenas como
--      sinal contextual: CPF exato com nome divergente dispara erro específico
--      LEAD_NAME_MISMATCH (nunca POSSIBLE_DUPLICATE) para confirmação humana.
--   4. CPF inexistente + contato conflitante => erro de negócio; somente cria
--      nova People mediante confirmação explícita (p_force_create = true).
--
-- Metadata de auditoria (seguro, sem PII) inclui identity_resolution:
--   'new_person'                    CPF ausente sem conflito, ou CPF sem match
--   'cpf_exact'                     reutilizou People por CPF exato (nome ok)
--   'cpf_exact_forced'              reutilizou People por CPF após confirmação
--                                   de divergência de nome (p_force_create)
--   'contact_conflict_forced'       criou nova People apesar de conflito de
--                                   contato confirmado (p_force_create)
--   'cpf_exact_name_mismatch'       divergência de nome (erro LEAD_NAME_MISMATCH)
--   'contact_conflict'              conflito (erro POSSIBLE_DUPLICATE)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Helper interno — equivalência de nome (sinal contextual de revisão)
--    Nome NUNCA resolve identidade. Serve apenas para detectar divergência
--    quando o CPF já existe e sugerir revisão humana.
--    Compatível: igualdade após normalizar (minúsc./espaços) e ignorar
--    conectivos ('de', 'da', 'do', 'dos', 'das', 'e').
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
-- 2. Assinaturas anteriores são removidas (nenhuma lógica antiga permanece)
-- ---------------------------------------------------------------------------
-- v1 (14 params — adicionou p_cpf)
drop function if exists public.create_crm_lead(
  text, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text, timestamptz
);
-- antecedentes (13 e 12 params), caso existam em algum ambiente
drop function if exists public.create_crm_lead(
  text, text, text, text, text, uuid, uuid, uuid, text, text, text, text, timestamptz
);
drop function if exists public.create_crm_lead(
  text, text, text, text, text, uuid, uuid, text, text, text, text, timestamptz
);

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
    -- Passo 2: CPF informado -> busca People por CPF exato
    select id, full_name into v_person_id, v_existing_full_name
    from public.people
    where cpf = v_normalized_cpf
    limit 1;

    if v_person_id is not null then
      -- Passo 3: encontrou -> reutiliza. Nome não resolve identidade: apenas
      -- sinal contextual. Qualquer divergência de nome exige revisão humana
      -- (erro específico — nunca POSSIBLE_DUPLICATE:name).
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
  -- Apenas detecta conflito para revisão manual.
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

  -- Passo 5: conflito controlado (retorna erro de negócio sem PII)
  -- Apenas contatos (phone/whatsapp/email) entram aqui. CPF nunca é
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

-- ---------------------------------------------------------------------------
-- 3. Grants explícitos — nova assinatura (15 params)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz,boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz,boolean) FROM public, anon;