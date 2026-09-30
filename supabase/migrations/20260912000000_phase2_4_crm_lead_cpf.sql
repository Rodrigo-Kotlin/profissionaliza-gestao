-- ---------------------------------------------------------------------------
-- 1. create_crm_lead — adiciona p_cpf como chave de identidade prioritária
--
--    Assinatura corrente (pipeline_stages_timeline, 13 params):
--      text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz
--    Nova assinatura (14 params — p_cpf text adicionado após p_email):
--      text,text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz
-- ---------------------------------------------------------------------------
-- DROP assinatura corrente (13 params)
drop function if exists public.create_crm_lead(
  text, text, text, text, text, uuid, uuid, uuid, text, text, text, text, timestamptz
);

-- DROP assinatura variantante (runtime_fixes, caso exista em algum ambiente)
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
  v_normalized_cpf text;
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
  v_normalized_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');

  -- Validação do CPF quando informado: exatamente 11 dígitos
  if v_normalized_cpf is not null and char_length(v_normalized_cpf) <> 11 then
    raise exception 'Invalid CPF: must contain 11 digits' using errcode = '22023';
  end if;

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

  -- Deduplicação com precedência: CPF > telefone/WhatsApp/e-mail (somente sem CPF)
  -- CPF é a chave de identidade mais forte quando informado. Não deduplica por
  -- nome em nenhuma hipótese. Quando o CPF não encontra match, cria nova People
  -- mesmo que telefone/WhatsApp/e-mail coincidam com outra People existente.
  if v_normalized_cpf is not null then
    select id into v_person_id
    from public.people
    where cpf = v_normalized_cpf
    limit 1;
  end if;

  -- Sem CPF: mantém o comportamento atual (deduplicação por telefone/WhatsApp/e-mail)
  if v_person_id is null and v_normalized_cpf is null then
    if v_normalized_phone is not null or v_normalized_whatsapp is not null or v_normalized_email is not null then
      select id into v_person_id
      from public.people
      where (v_normalized_phone is not null and phone = v_normalized_phone)
         or (v_normalized_whatsapp is not null and whatsapp = v_normalized_whatsapp)
         or (v_normalized_email is not null and lower(email) = v_normalized_email)
      limit 1;
    end if;
  end if;

  -- Cria pessoa se não encontrou
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

  -- Auditoria (sem expor CPF em metadata)
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
-- 2. Grants explícitos — nova assinatura (14 params)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,text,uuid,uuid,uuid,text,text,text,text,timestamptz) FROM public, anon;