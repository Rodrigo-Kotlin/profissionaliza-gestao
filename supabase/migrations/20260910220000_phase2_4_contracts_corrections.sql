-- ============================================================================
-- FASE 2.4 — CONTRACTS CORRECTIONS (pré-homologação)
-- Migration corretiva: CREATE OR REPLACE para cancel_contract e create_person.
--
-- cancel_contract:
--   - REMOVE cancellation_reason do audit_logs.metadata (PII potencial)
--   - ADICIONA previous_status ao metadata
--   - Mantém cancellation_reason na tabela contracts (obrigatório)
--
-- create_person:
--   - Emite 'people.created' apenas quando pessoa é nova (reused = false)
--   - Emite 'people.reused' quando CPF já existe (reused = true)
--   - Nunca emite ambos na mesma operação
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. cancel_contract — sem PII no audit metadata
-- ---------------------------------------------------------------------------
create or replace function public.cancel_contract(
  p_contract_id uuid,
  p_reason      text
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.cancel') then
    raise exception 'Permission denied: contracts.cancel' using errcode = '42501';
  end if;

  select * into v_contract from public.contracts where id = p_contract_id for update;

  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if v_contract.status not in ('DRAFT', 'PENDING_SIGNATURE') then
    raise exception 'Only draft or pending signature contracts can be canceled' using errcode = '22023';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Cancellation reason is required' using errcode = '22023';
  end if;

  if char_length(trim(p_reason)) > 2000 then
    raise exception 'Cancellation reason must be at most 2000 characters' using errcode = '22023';
  end if;

  update public.contracts set
    status = 'CANCELED',
    canceled_at = now(),
    canceled_by = auth.uid(),
    cancellation_reason = trim(p_reason),
    updated_by = auth.uid()
  where id = p_contract_id;

  -- Auditoria server-side: apenas dados seguros, sem cancellation_reason (PII potencial).
  perform public.write_audit_log(
    'contracts.canceled', 'contract', p_contract_id::text,
    jsonb_build_object(
      'contract_code', v_contract.contract_code,
      'sale_id', v_contract.sale_id::text,
      'previous_status', v_contract.status,
      'new_status', 'CANCELED'
    )
  );

  return json_build_object('contract_id', p_contract_id, 'contract_code', v_contract.contract_code, 'status', 'CANCELED');
end;
$$;

revoke execute on function public.cancel_contract(uuid,text) from public, anon;
grant execute on function public.cancel_contract(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. create_person — audit condicional: people.created ou people.reused
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
      nullif(ltrim(coalesce(p_postal_code, ''), '0'), ''),
      nullif(trim(coalesce(p_street, '')), ''), nullif(trim(coalesce(p_number, '')), ''),
      nullif(trim(coalesce(p_complement, '')), ''), nullif(trim(coalesce(p_district, '')), ''),
      nullif(trim(coalesce(p_city, '')), ''), nullif(upper(trim(coalesce(p_state, ''))), ''),
      nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
      nullif(regexp_replace(coalesce(p_emergency_contact_phone, ''), '\D', '', 'g'), ''),
      nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  -- Auditoria server-side sem PII: event condicional.
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

commit;