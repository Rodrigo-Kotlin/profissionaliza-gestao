-- ============================================================================
-- FASE 2.4 — CONTRACTS CORE
-- Tabela public.contracts, sequence de contrato, permissions, matriz RBAC,
-- suporte de identidade (people.create p/ RECEPCAO) e RPC create_person.
--
-- Princípios:
--   - Contract é domínio próprio: nasce de Sale CONFIRMED, nunca é Sale/Student.
--   - one Sale -> max one Contract (sale_id UNIQUE).
--   - CANCELED é terminal (MVP): sem replacement/reissue/amendment/versioning.
--   - Snapshots imutáveis desde a criação; contractor editável apenas em DRAFT.
--   - Acesso exclusivo por RPC SECURITY DEFINER (RPC-only, sem policies).
--   - PII decidido no PostgreSQL: nunca enviar CPF/endereço ao frontend sem view_sensitive.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. SEQUENCE DE CONTRATO (concorrente-segura, sem reset anual, sem MAX+1)
-- ---------------------------------------------------------------------------
create sequence if not exists public.contract_code_seq as integer;

revoke all on sequence public.contract_code_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. TABELA CONTRACTS
-- ---------------------------------------------------------------------------
create table if not exists public.contracts (
  id                        uuid primary key default gen_random_uuid(),
  contract_code             text not null unique,
  sale_id                   uuid not null unique references public.sales(id) on delete restrict,
  student_id                uuid not null references public.students(id) on delete restrict,
  contractor_person_id      uuid not null references public.people(id) on delete restrict,
  status                    text not null default 'DRAFT',
  student_name_snapshot     text not null,
  contractor_name_snapshot  text not null,
  contractor_cpf_snapshot   text,
  contractor_address_snapshot jsonb,
  contractor_phone_snapshot text,
  contractor_email_snapshot text,
  course_name_snapshot      text not null,
  course_workload_snapshot  integer,
  course_modality_snapshot  text not null,
  gross_value_snapshot      numeric(12,2) not null,
  discount_value_snapshot   numeric(12,2) not null default 0,
  net_value_snapshot        numeric(12,2) not null,
  payment_method_snapshot   text not null,
  installments_snapshot     integer not null default 1,
  commercial_notes_snapshot text,
  contract_notes            text,
  issued_at                 timestamptz,
  signed_at                 timestamptz,
  signature_confirmed_by    uuid references auth.users(id) on delete set null,
  canceled_at               timestamptz,
  canceled_by               uuid references auth.users(id) on delete set null,
  cancellation_reason       text,
  created_by                uuid references auth.users(id) on delete set null,
  updated_by                uuid references auth.users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint contracts_contract_code_format check (contract_code ~ '^CTR-[0-9]{4}-[0-9]{6}$'),
  constraint contracts_status_check check (status in ('DRAFT','PENDING_SIGNATURE','SIGNED','CANCELED')),
  constraint contracts_gross_non_negative check (gross_value_snapshot >= 0),
  constraint contracts_discount_non_negative check (discount_value_snapshot >= 0),
  constraint contracts_discount_lte_gross check (gross_value_snapshot >= discount_value_snapshot),
  constraint contracts_installments_min check (installments_snapshot >= 1),
  constraint contracts_payment_method_check check (payment_method_snapshot in (
    'PIX','DINHEIRO','CARTAO_CREDITO','CARTAO_DEBITO','BOLETO','TRANSFERENCIA','OUTRO'
  )),
  constraint contracts_modality_check check (course_modality_snapshot in (
    'PRESENCIAL','ONLINE','HIBRIDO'
  )),
  constraint contracts_cpf_snapshot_format check (
    contractor_cpf_snapshot is null or contractor_cpf_snapshot ~ '^[0-9]{11}$'
  ),
  constraint contracts_cancellation_reason_length check (
    cancellation_reason is null or char_length(trim(cancellation_reason)) <= 2000
  ),
  -- Coerência de status (section 11): campos obrigatórios/proibidos por estado.
  constraint contracts_status_coherence_check check (
    (status = 'DRAFT'
      and issued_at is null
      and signed_at is null
      and signature_confirmed_by is null
      and canceled_at is null
      and canceled_by is null
      and cancellation_reason is null)
    or
    (status = 'PENDING_SIGNATURE'
      and issued_at is not null
      and signed_at is null
      and signature_confirmed_by is null
      and canceled_at is null
      and canceled_by is null
      and cancellation_reason is null)
    or
    (status = 'SIGNED'
      and issued_at is not null
      and signed_at is not null
      and signature_confirmed_by is not null
      and canceled_at is null
      and canceled_by is null
      and cancellation_reason is null)
    or
    (status = 'CANCELED'
      and signed_at is null
      and signature_confirmed_by is null
      and canceled_at is not null
      and canceled_by is not null
      and cancellation_reason is not null
      and char_length(trim(cancellation_reason)) > 0)
  )
);

-- Índices (contract_code e sale_id já criam índice via UNIQUE).
create index if not exists contracts_status_idx on public.contracts(status);
create index if not exists contracts_created_at_idx on public.contracts(created_at desc);
create index if not exists contracts_student_id_idx on public.contracts(student_id);
create index if not exists contracts_contractor_person_id_idx on public.contracts(contractor_person_id);

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — RPC-ONLY: sem policies, sem acesso direto
-- ---------------------------------------------------------------------------
alter table public.contracts enable row level security;
revoke all on table public.contracts from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. PERMISSIONS CONTRACTS (8)
-- ---------------------------------------------------------------------------
insert into public.permissions (code, name, description, module) values
  ('contracts.view', 'Visualizar contratos', 'Consultar contratos. Dados pessoais mascarados.', 'contracts'),
  ('contracts.view_all', 'Visualizar todos os contratos', 'Visualizar contratos de outros vendedores.', 'contracts'),
  ('contracts.view_sensitive', 'Visualizar dados sensíveis de contrato', 'Acessar CPF/telefone/email/endereço completos do contratante.', 'contracts'),
  ('contracts.create', 'Criar contratos', 'Gerar contratos a partir de venda confirmada.', 'contracts'),
  ('contracts.edit_draft', 'Editar rascunho de contrato', 'Trocar contratante e notas em contratos DRAFT.', 'contracts'),
  ('contracts.issue', 'Emitir contrato', 'Transicionar DRAFT para PENDING_SIGNATURE.', 'contracts'),
  ('contracts.mark_signed', 'Confirmar assinatura', 'Marcar contrato emitido como assinado.', 'contracts'),
  ('contracts.cancel', 'Cancelar contratos', 'Cancelar contratos antes da assinatura.', 'contracts')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 5. MATRIZ RBAC CONTRACTS
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'ADMIN'
  and p.code in (
    'contracts.view','contracts.view_all','contracts.view_sensitive','contracts.create',
    'contracts.edit_draft','contracts.issue','contracts.mark_signed','contracts.cancel'
  )
on conflict do nothing;

with grants(role_code, permission_code) as (values
  -- DIRECAO: full contracts
  ('DIRECAO','contracts.view'),('DIRECAO','contracts.view_all'),('DIRECAO','contracts.view_sensitive'),
  ('DIRECAO','contracts.create'),('DIRECAO','contracts.edit_draft'),('DIRECAO','contracts.issue'),
  ('DIRECAO','contracts.mark_signed'),('DIRECAO','contracts.cancel'),
  -- GERENTE_COMERCIAL: full contracts
  ('GERENTE_COMERCIAL','contracts.view'),('GERENTE_COMERCIAL','contracts.view_all'),('GERENTE_COMERCIAL','contracts.view_sensitive'),
  ('GERENTE_COMERCIAL','contracts.create'),('GERENTE_COMERCIAL','contracts.edit_draft'),('GERENTE_COMERCIAL','contracts.issue'),
  ('GERENTE_COMERCIAL','contracts.mark_signed'),('GERENTE_COMERCIAL','contracts.cancel'),
  -- VENDEDOR: view + create + edit_draft (own only enforced na RPC); sem issue/sign/cancel/view_all/sensitive
  ('VENDEDOR','contracts.view'),('VENDEDOR','contracts.create'),('VENDEDOR','contracts.edit_draft'),
  -- RECEPCAO: tudo exceto cancel
  ('RECEPCAO','contracts.view'),('RECEPCAO','contracts.view_all'),('RECEPCAO','contracts.view_sensitive'),
  ('RECEPCAO','contracts.create'),('RECEPCAO','contracts.edit_draft'),('RECEPCAO','contracts.issue'),
  ('RECEPCAO','contracts.mark_signed')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

-- FINANCEIRO, PEDAGOGICO e PROFESSOR permanecem sem nenhuma permissão de contracts.

-- ---------------------------------------------------------------------------
-- 6. PEOPLE RBAC — RECEPCAO recebe people.create para cadastro de contratante.
--    ADMIN e DIRECAO já possuem people.create. GERENTE_COMERCIAL e VENDEDOR não.
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'people.create'
where r.code = 'RECEPCAO'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 7. RPC — create_person (domínio People/Identity, acoplada a nenhum outro domínio)
-- ---------------------------------------------------------------------------
-- Estratégia de duplicidade (documentada):
--   CPF informado com match exato em public.people -> reutiliza e retorna
--   { person_id, reused: true }. Nunca auto-merge por nome/telefone/email.
--   Sem CPF -> sempre cria nova pessoa (constraints de people protegem uniqueness).
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

  -- Auditoria server-side sem PII (CPF, RG, endereço, telefone e email são omitidos).
  perform public.write_audit_log(
    'people.created', 'person', v_person_id::text,
    jsonb_build_object('reused', v_reused)
  );

  return json_build_object('person_id', v_person_id, 'reused', v_reused);
end;
$$;

revoke execute on function public.create_person(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.create_person(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;

commit;