-- ============================================================================
-- FASE 2.4 — CONTRACTS AUDITORIA E2E (Data Reuse)
-- 1. get_contractor_detail — dados completos do contratante para o wizard
-- 2. update_person           — atualização pontual da People (domínio Identity)
--
-- Objetivo (documento de auditoria §3, §7, §8, §9):
--   O wizard de contrato precisa REUTILIZAR dados existentes de People sem
--   redigitação. Para isso o frontend precisa:
--     a) obter a detail de uma pessoa (para pré-preencher e conferir);
--     b) atualizar apenas campos faltantes da identidade existente.
--
-- Decisões:
--   - Nenhuma permissão nova é criada nem concedida nesta migration.
--   - get_contractor_detail  exige contracts.create OU contracts.edit_draft
--     (quem abre o wizard ou edita o rascunho), aplicando mascaramento PII
--     no PostgreSQL conforme contracts.view_sensitive (padrão do projeto:
--     o frontend nunca recebe valor completo sem permissão).
--   - update_person respeita people.edit e o padrão de gate sensível já
--     usado por update_student (contracts.view_sensitive OR students.view_sensitive
--     para campos de PII). CPF continua sendo chave de identidade e NUNCA é
--     editado aqui.
--   - Nenhuma RPC existente atende aos dois requisitos (auditoria §9):
--     update_student acopla ao domínio de alunos e exige students.edit;
--     create_person cria (não edita) e exige people.create.
--   - Sempre RPC-only; nenhum SELECT direto em public.people no frontend.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. RPC — get_contractor_detail
--    Retorna os dados cadastrais da pessoa selecionada como contratante.
--    Mascaramento PII decidido no PostgreSQL (contracts.view_sensitive).
--    birth_date segue a convenção de students (não mascarado), RG e
--    endereço completos somente com view_sensitive.
-- ---------------------------------------------------------------------------
create or replace function public.get_contractor_detail(
  p_person_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person    record;
  v_sensitive boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.create') and not public.has_permission('contracts.edit_draft') then
    raise exception 'Permission denied: contracts.create or contracts.edit_draft' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('contracts.view_sensitive');

  select * into v_person
  from public.people
  where id = p_person_id;

  if v_person is null then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;

  return json_build_object(
    'person_id', v_person.id,
    'full_name', v_person.full_name,
    'preferred_name', v_person.preferred_name,
    'cpf', case when v_sensitive then v_person.cpf else public.mask_cpf(v_person.cpf) end,
    'rg', case when v_sensitive then v_person.rg else null end,
    'birth_date', v_person.birth_date,
    'email', case when v_sensitive then v_person.email else public.mask_email(v_person.email) end,
    'phone', case when v_sensitive then v_person.phone else public.mask_phone(v_person.phone) end,
    'whatsapp', case when v_sensitive then v_person.whatsapp else public.mask_phone(v_person.whatsapp) end,
    'postal_code', case when v_sensitive then v_person.postal_code else null end,
    'street', case when v_sensitive then v_person.street else null end,
    'number', case when v_sensitive then v_person.number else null end,
    'complement', case when v_sensitive then v_person.complement else null end,
    'district', case when v_sensitive then v_person.district else null end,
    'city', case when v_sensitive then v_person.city else null end,
    'state', case when v_sensitive then v_person.state else null end,
    'sensitive', v_sensitive
  );
end;
$$;

revoke execute on function public.get_contractor_detail(uuid) from public, anon;
grant execute on function public.get_contractor_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. RPC — update_person (domínio People/Identity)
--    Atualização parcial: parâmetro nulo/omisso = não altera; string vazia
--    = limpa o campo. CPF não é editável (chave de identidade).
--    Campos sensíveis (email/telefone/whatsapp/CEP/endereço/emergência)
--    somente editáveis por quem possui contratos.view_sensitive OU
--    students.view_sensitive (mesmo padrão do update_student).
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
      else nullif(regexp_replace(p_postal_code, '\D', '', 'g'), '')
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

commit;