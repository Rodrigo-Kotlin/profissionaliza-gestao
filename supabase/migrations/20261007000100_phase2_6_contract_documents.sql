-- FASE 2.6B1 — FUNDAÇÃO DOCUMENTAL
-- Documento original versionado + execução GOV.BR/física.
-- Esta migration não gera PDF, não valida assinatura e não altera mark_contract_signed.

begin;

-- -----------------------------------------------------------------------------
-- 1. Storage privado para documentos contratuais
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contract-documents', 'contract-documents', false, 52428800, array['application/pdf']::text[])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 2. Documentos originais
-- -----------------------------------------------------------------------------
create table if not exists public.contract_documents (
  id                         uuid primary key default gen_random_uuid(),
  contract_id                uuid not null references public.contracts(id) on delete restrict,
  document_code              text not null unique,
  version                    integer not null,
  document_type              text not null,
  status                     text not null default 'DRAFT',
  template_version           text not null,
  document_payload           jsonb not null,
  canonical_payload_hash     text,
  original_file_path         text,
  original_file_name         text,
  original_mime_type         text,
  original_file_size         bigint,
  original_sha256            text,
  generated_at               timestamptz,
  generated_by               uuid references auth.users(id) on delete set null,
  issued_at                  timestamptz,
  superseded_at              timestamptz,
  previous_document_id       uuid references public.contract_documents(id) on delete restrict,
  superseded_by_document_id  uuid references public.contract_documents(id) on delete restrict,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint contract_documents_version_positive check (version >= 1),
  constraint contract_documents_type_format check (document_type ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint contract_documents_status_check check (status in ('DRAFT', 'FINAL', 'SUPERSEDED', 'VOID')),
  constraint contract_documents_payload_object check (jsonb_typeof(document_payload) = 'object'),
  constraint contract_documents_original_size_check check (original_file_size is null or original_file_size >= 0),
  constraint contract_documents_original_mime_check check (original_mime_type is null or original_mime_type = 'application/pdf'),
  constraint contract_documents_hash_format check (
    (canonical_payload_hash is null or canonical_payload_hash ~ '^[0-9a-f]{64}$') and
    (original_sha256 is null or original_sha256 ~ '^[0-9a-f]{64}$')
  ),
  constraint contract_documents_self_reference_check check (
    previous_document_id is null or previous_document_id <> id
  ),
  constraint contract_documents_final_file_check check (
    status = 'DRAFT' or (
      original_file_path is not null and
      original_file_name is not null and
      original_mime_type = 'application/pdf' and
      original_file_size is not null and
      original_sha256 is not null and
      generated_at is not null and
      generated_by is not null and
      issued_at is not null
    )
  )
);

create unique index if not exists contract_documents_contract_version_uidx
  on public.contract_documents(contract_id, version);
create index if not exists contract_documents_contract_status_idx
  on public.contract_documents(contract_id, status);
create index if not exists contract_documents_created_at_idx
  on public.contract_documents(created_at desc);

drop trigger if exists contract_documents_set_updated_at on public.contract_documents;
create trigger contract_documents_set_updated_at before update on public.contract_documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Execuções de formalização
-- -----------------------------------------------------------------------------
create table if not exists public.contract_executions (
  id                    uuid primary key default gen_random_uuid(),
  contract_document_id  uuid not null references public.contract_documents(id) on delete restrict,
  execution_method      text not null,
  status                text not null default 'PENDING_UPLOAD',
  signer_person_id      uuid references public.people(id) on delete restrict,
  signer_name_snapshot  text not null,
  signed_file_path      text,
  signed_file_name      text,
  signed_mime_type      text,
  signed_file_size      bigint,
  signed_sha256         text,
  signed_at             timestamptz,
  received_at           timestamptz,
  received_by           uuid references auth.users(id) on delete set null,
  verified_at           timestamptz,
  verified_by           uuid references auth.users(id) on delete set null,
  verification_method   text,
  verification_notes    text,
  rejected_at           timestamptz,
  rejected_by           uuid references auth.users(id) on delete set null,
  rejection_reason      text,
  evidence_json         jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint contract_executions_method_check check (
    execution_method in ('GOV_BR', 'PHYSICAL', 'EXTERNAL_PROVIDER', 'ICP_BRASIL')
  ),
  constraint contract_executions_status_check check (
    status in ('PENDING_UPLOAD', 'RECEIVED', 'VERIFIED', 'REJECTED')
  ),
  constraint contract_executions_signer_name_check check (char_length(trim(signer_name_snapshot)) between 1 and 240),
  constraint contract_executions_file_size_check check (signed_file_size is null or signed_file_size >= 0),
  constraint contract_executions_mime_check check (signed_mime_type is null or signed_mime_type = 'application/pdf'),
  constraint contract_executions_hash_check check (signed_sha256 is null or signed_sha256 ~ '^[0-9a-f]{64}$'),
  constraint contract_executions_evidence_object_check check (
    evidence_json is null or jsonb_typeof(evidence_json) = 'object'
  ),
  constraint contract_executions_rejected_reason_check check (
    status <> 'REJECTED' or (
      rejected_at is not null and rejected_by is not null and
      rejection_reason is not null and char_length(trim(rejection_reason)) > 0
    )
  ),
  constraint contract_executions_verified_fields_check check (
    status <> 'VERIFIED' or (verified_at is not null and verified_by is not null)
  )
);

create index if not exists contract_executions_document_status_idx
  on public.contract_executions(contract_document_id, status);
create index if not exists contract_executions_created_at_idx
  on public.contract_executions(created_at desc);

drop trigger if exists contract_executions_set_updated_at on public.contract_executions;
create trigger contract_executions_set_updated_at before update on public.contract_executions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Imutabilidade e transições controladas
-- -----------------------------------------------------------------------------
create or replace function public.guard_contract_document_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  if old.status in ('FINAL', 'SUPERSEDED', 'VOID') and (
    new.contract_id is distinct from old.contract_id or
    new.document_code is distinct from old.document_code or
    new.version is distinct from old.version or
    new.document_type is distinct from old.document_type or
    new.template_version is distinct from old.template_version or
    new.document_payload is distinct from old.document_payload or
    new.canonical_payload_hash is distinct from old.canonical_payload_hash or
    new.original_file_path is distinct from old.original_file_path or
    new.original_file_name is distinct from old.original_file_name or
    new.original_mime_type is distinct from old.original_mime_type or
    new.original_file_size is distinct from old.original_file_size or
    new.original_sha256 is distinct from old.original_sha256 or
    new.generated_at is distinct from old.generated_at or
    new.generated_by is distinct from old.generated_by or
    new.issued_at is distinct from old.issued_at
  ) then
    raise exception 'Finalized contract documents are immutable' using errcode = '55000';
  end if;

  if old.status in ('SUPERSEDED', 'VOID') and new.status is distinct from old.status then
    raise exception 'Superseded or void contract documents are terminal' using errcode = '55000';
  end if;

  if old.status = 'FINAL' and new.status not in ('FINAL', 'SUPERSEDED', 'VOID') then
    raise exception 'Final contract documents can only be superseded or voided' using errcode = '22023';
  end if;

  if old.status = 'DRAFT' and new.status not in ('DRAFT', 'FINAL', 'VOID') then
    raise exception 'Draft contract documents can only be finalized or voided' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists contract_documents_guard_mutation on public.contract_documents;
create trigger contract_documents_guard_mutation before update on public.contract_documents
  for each row execute function public.guard_contract_document_mutation();

create or replace function public.guard_contract_execution_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  if old.contract_document_id is distinct from new.contract_document_id or
     old.execution_method is distinct from new.execution_method or
     old.signer_person_id is distinct from new.signer_person_id or
     old.signer_name_snapshot is distinct from new.signer_name_snapshot then
    raise exception 'Contract execution identity is immutable' using errcode = '55000';
  end if;

  if old.status in ('VERIFIED', 'REJECTED') and new.status is distinct from old.status then
    raise exception 'Verified or rejected executions are terminal' using errcode = '55000';
  end if;

  if old.status = 'PENDING_UPLOAD' and new.status not in ('PENDING_UPLOAD', 'RECEIVED', 'REJECTED') then
    raise exception 'Pending executions can only be received or rejected' using errcode = '22023';
  end if;

  if old.status = 'RECEIVED' and new.status not in ('RECEIVED', 'VERIFIED', 'REJECTED') then
    raise exception 'Received executions can only be verified or rejected' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists contract_executions_guard_mutation on public.contract_executions;
create trigger contract_executions_guard_mutation before update on public.contract_executions
  for each row execute function public.guard_contract_execution_mutation();

-- -----------------------------------------------------------------------------
-- 5. RPC-only: sem acesso direto às tabelas
-- -----------------------------------------------------------------------------
alter table public.contract_documents enable row level security;
alter table public.contract_executions enable row level security;
revoke all on table public.contract_documents from public, anon, authenticated;
revoke all on table public.contract_executions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. Permissões e matriz inicial
-- -----------------------------------------------------------------------------
insert into public.permissions (code, name, description, module) values
  ('contracts.documents.view', 'Visualizar documentos de contratos', 'Consultar documentos contratuais no escopo permitido.', 'contracts'),
  ('contracts.documents.generate', 'Gerar documentos de contratos', 'Criar rascunhos de documentos contratuais.', 'contracts'),
  ('contracts.documents.supersede', 'Substituir documentos de contratos', 'Criar nova versão e substituir documento anterior.', 'contracts'),
  ('contracts.execution.view', 'Visualizar formalizações', 'Consultar execuções de formalização documental.', 'contracts'),
  ('contracts.execution.upload', 'Receber formalizações', 'Registrar recebimento de arquivo formalizado.', 'contracts'),
  ('contracts.execution.verify', 'Verificar formalizações', 'Conferir e validar formalizações documentais.', 'contracts'),
  ('contracts.execution.reject', 'Rejeitar formalizações', 'Rejeitar formalizações com motivo obrigatório.', 'contracts')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

with grants(role_code, permission_code) as (values
  ('ADMIN', 'contracts.documents.view'), ('ADMIN', 'contracts.documents.generate'),
  ('ADMIN', 'contracts.documents.supersede'), ('ADMIN', 'contracts.execution.view'),
  ('ADMIN', 'contracts.execution.upload'), ('ADMIN', 'contracts.execution.verify'),
  ('ADMIN', 'contracts.execution.reject'),
  ('DIRECAO', 'contracts.documents.view'), ('DIRECAO', 'contracts.documents.generate'),
  ('DIRECAO', 'contracts.documents.supersede'), ('DIRECAO', 'contracts.execution.view'),
  ('DIRECAO', 'contracts.execution.upload'), ('DIRECAO', 'contracts.execution.verify'),
  ('DIRECAO', 'contracts.execution.reject'),
  ('GERENTE_COMERCIAL', 'contracts.documents.view'), ('GERENTE_COMERCIAL', 'contracts.documents.generate'),
  ('GERENTE_COMERCIAL', 'contracts.execution.view'), ('GERENTE_COMERCIAL', 'contracts.execution.upload'),
  ('GERENTE_COMERCIAL', 'contracts.execution.verify'), ('GERENTE_COMERCIAL', 'contracts.execution.reject'),
  ('VENDEDOR', 'contracts.documents.view'), ('RECEPCAO', 'contracts.documents.view'),
  ('RECEPCAO', 'contracts.execution.view'), ('RECEPCAO', 'contracts.execution.upload'),
  ('RECEPCAO', 'contracts.execution.verify'), ('RECEPCAO', 'contracts.execution.reject')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 7. Helpers de autorização
-- -----------------------------------------------------------------------------
create or replace function public._can_access_contract_document(p_contract_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select public.has_permission('contracts.view_all') or exists (
    select 1
    from public.contracts c
    join public.sales s on s.id = c.sale_id
    where c.id = p_contract_id and s.seller_user_id = auth.uid()
  );
$$;

create or replace function public._contract_id_for_document(p_document_id uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select contract_id from public.contract_documents where id = p_document_id;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPCs de leitura
-- -----------------------------------------------------------------------------
create or replace function public.list_contract_documents(p_contract_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_data json;
begin
  if auth.uid() is null or not public.has_permission('contracts.documents.view') then
    raise exception 'Permission denied: contracts.documents.view' using errcode = '42501';
  end if;
  if not public._can_access_contract_document(p_contract_id) then
    raise exception 'Not authorized to view contract documents' using errcode = '42501';
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.version desc), '[]'::json) into v_data
  from (
    select id as document_id, contract_id, document_code, version, document_type, status,
           template_version, original_file_name, original_mime_type, original_file_size,
           original_sha256, generated_at, generated_by, issued_at, superseded_at,
           previous_document_id, superseded_by_document_id, created_at, updated_at
    from public.contract_documents
    where contract_id = p_contract_id
  ) t;
  return json_build_object('data', v_data, 'total', json_array_length(v_data));
end;
$$;

create or replace function public.get_contract_document_detail(p_document_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract_id uuid;
  v_result json;
begin
  if auth.uid() is null or not public.has_permission('contracts.documents.view') then
    raise exception 'Permission denied: contracts.documents.view' using errcode = '42501';
  end if;
  v_contract_id := public._contract_id_for_document(p_document_id);
  if v_contract_id is null then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_contract_id) then
    raise exception 'Not authorized to view contract document' using errcode = '42501';
  end if;

  select json_build_object(
    'document_id', d.id, 'contract_id', d.contract_id, 'document_code', d.document_code,
    'version', d.version, 'document_type', d.document_type, 'status', d.status,
    'template_version', d.template_version, 'document_payload', d.document_payload,
    'canonical_payload_hash', d.canonical_payload_hash, 'original_file_path', d.original_file_path,
    'original_file_name', d.original_file_name, 'original_mime_type', d.original_mime_type,
    'original_file_size', d.original_file_size, 'original_sha256', d.original_sha256,
    'generated_at', d.generated_at, 'generated_by', d.generated_by, 'issued_at', d.issued_at,
    'superseded_at', d.superseded_at, 'previous_document_id', d.previous_document_id,
    'superseded_by_document_id', d.superseded_by_document_id, 'created_at', d.created_at,
    'updated_at', d.updated_at
  ) into v_result
  from public.contract_documents d where d.id = p_document_id;
  return v_result;
end;
$$;

create or replace function public.list_contract_executions(p_document_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract_id uuid;
  v_data json;
begin
  if auth.uid() is null or not public.has_permission('contracts.execution.view') then
    raise exception 'Permission denied: contracts.execution.view' using errcode = '42501';
  end if;
  v_contract_id := public._contract_id_for_document(p_document_id);
  if v_contract_id is null then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_contract_id) then
    raise exception 'Not authorized to view contract executions' using errcode = '42501';
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) into v_data
  from (
    select e.id as execution_id, e.contract_document_id, e.execution_method, e.status,
           e.signer_person_id, e.signer_name_snapshot, e.signed_file_name, e.signed_mime_type,
           e.signed_file_size, e.signed_sha256, e.signed_at, e.received_at, e.received_by,
           e.verified_at, e.verified_by, e.verification_method, e.rejected_at, e.rejected_by,
           e.rejection_reason, e.created_at, e.updated_at
    from public.contract_executions e where e.contract_document_id = p_document_id
  ) t;
  return json_build_object('data', v_data, 'total', json_array_length(v_data));
end;
$$;

create or replace function public.get_contract_execution_detail(p_execution_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract_id uuid;
  v_result json;
begin
  if auth.uid() is null or not public.has_permission('contracts.execution.view') then
    raise exception 'Permission denied: contracts.execution.view' using errcode = '42501';
  end if;
  select d.contract_id into v_contract_id
  from public.contract_executions e join public.contract_documents d on d.id = e.contract_document_id
  where e.id = p_execution_id;
  if v_contract_id is null then raise exception 'Execution not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_contract_id) then
    raise exception 'Not authorized to view contract execution' using errcode = '42501';
  end if;

  select json_build_object(
    'execution_id', e.id, 'contract_document_id', e.contract_document_id,
    'execution_method', e.execution_method, 'status', e.status,
    'signer_person_id', e.signer_person_id, 'signer_name_snapshot', e.signer_name_snapshot,
    'signed_file_path', e.signed_file_path, 'signed_file_name', e.signed_file_name,
    'signed_mime_type', e.signed_mime_type, 'signed_file_size', e.signed_file_size,
    'signed_sha256', e.signed_sha256, 'signed_at', e.signed_at, 'received_at', e.received_at,
    'received_by', e.received_by, 'verified_at', e.verified_at, 'verified_by', e.verified_by,
    'verification_method', e.verification_method, 'verification_notes', e.verification_notes,
    'rejected_at', e.rejected_at, 'rejected_by', e.rejected_by,
    'rejection_reason', e.rejection_reason, 'evidence_json', e.evidence_json,
    'created_at', e.created_at, 'updated_at', e.updated_at
  ) into v_result
  from public.contract_executions e where e.id = p_execution_id;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPCs de escrita da fundação
-- -----------------------------------------------------------------------------
create or replace function public.create_contract_document_draft(
  p_contract_id uuid,
  p_document_type text,
  p_template_version text,
  p_document_payload jsonb
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
  v_version integer;
  v_document_id uuid;
  v_document_code text;
begin
  if auth.uid() is null or not public.has_permission('contracts.documents.generate') then
    raise exception 'Permission denied: contracts.documents.generate' using errcode = '42501';
  end if;
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if v_contract.status <> 'DRAFT' then
    raise exception 'Only draft contracts can create document drafts' using errcode = '22023';
  end if;
  if not public._can_access_contract_document(p_contract_id) then
    raise exception 'Not authorized to create contract document' using errcode = '42501';
  end if;
  if p_document_payload is null or jsonb_typeof(p_document_payload) <> 'object' then
    raise exception 'Document payload must be a JSON object' using errcode = '22023';
  end if;
  if p_template_version is null or char_length(trim(p_template_version)) = 0 then
    raise exception 'Template version is required' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.contract_documents where contract_id = p_contract_id;
  v_document_code := replace(v_contract.contract_code, 'CTR-', 'DOC-CTR-') || '-V' || lpad(v_version::text, 2, '0');

  insert into public.contract_documents (
    contract_id, document_code, version, document_type, status, template_version, document_payload, generated_by
  ) values (
    p_contract_id, v_document_code, v_version, upper(trim(p_document_type)), 'DRAFT', trim(p_template_version), p_document_payload, auth.uid()
  ) returning id into v_document_id;

  perform public.write_audit_log(
    'contract.document_draft_created', 'contract_document', v_document_id::text,
    jsonb_build_object('contract_id', p_contract_id::text, 'document_code', v_document_code, 'version', v_version, 'status', 'DRAFT')
  );
  return json_build_object('document_id', v_document_id, 'contract_id', p_contract_id, 'document_code', v_document_code, 'version', v_version, 'status', 'DRAFT');
end;
$$;

create or replace function public.create_contract_execution(
  p_contract_document_id uuid,
  p_execution_method text,
  p_signer_person_id uuid,
  p_signer_name_snapshot text,
  p_signed_at timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_document record;
  v_execution_id uuid;
begin
  if auth.uid() is null or not public.has_permission('contracts.execution.upload') then
    raise exception 'Permission denied: contracts.execution.upload' using errcode = '42501';
  end if;
  select d.* into v_document from public.contract_documents d where d.id = p_contract_document_id;
  if v_document is null then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_document.contract_id) then
    raise exception 'Not authorized to create contract execution' using errcode = '42501';
  end if;
  if v_document.status <> 'FINAL' then
    raise exception 'Only final documents can be formalized' using errcode = '22023';
  end if;
  if p_execution_method not in ('GOV_BR', 'PHYSICAL') then
    raise exception 'Execution method is not implemented in this phase' using errcode = '22023';
  end if;
  if p_signer_name_snapshot is null or char_length(trim(p_signer_name_snapshot)) = 0 then
    raise exception 'Signer name is required' using errcode = '22023';
  end if;
  if p_signed_at is not null and p_signed_at > now() then
    raise exception 'Signed date cannot be in the future' using errcode = '22023';
  end if;

  insert into public.contract_executions (
    contract_document_id, execution_method, status, signer_person_id, signer_name_snapshot, signed_at
  ) values (
    p_contract_document_id, p_execution_method, 'PENDING_UPLOAD', p_signer_person_id, trim(p_signer_name_snapshot), p_signed_at
  ) returning id into v_execution_id;

  perform public.write_audit_log(
    'contract.execution_created', 'contract_execution', v_execution_id::text,
    jsonb_build_object('contract_document_id', p_contract_document_id::text, 'execution_method', p_execution_method, 'status', 'PENDING_UPLOAD')
  );
  return json_build_object('execution_id', v_execution_id, 'contract_document_id', p_contract_document_id, 'execution_method', p_execution_method, 'status', 'PENDING_UPLOAD');
end;
$$;

create or replace function public.reject_contract_execution(
  p_execution_id uuid,
  p_rejection_reason text
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_execution record;
begin
  if auth.uid() is null or not public.has_permission('contracts.execution.reject') then
    raise exception 'Permission denied: contracts.execution.reject' using errcode = '42501';
  end if;
  select e.*, d.contract_id into v_execution
  from public.contract_executions e join public.contract_documents d on d.id = e.contract_document_id
  where e.id = p_execution_id for update;
  if v_execution is null then raise exception 'Execution not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_execution.contract_id) then
    raise exception 'Not authorized to reject contract execution' using errcode = '42501';
  end if;
  if v_execution.status <> 'RECEIVED' then
    raise exception 'Only received executions can be rejected' using errcode = '22023';
  end if;
  if p_rejection_reason is null or char_length(trim(p_rejection_reason)) = 0 then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;

  update public.contract_executions set
    status = 'REJECTED', rejected_at = now(), rejected_by = auth.uid(), rejection_reason = trim(p_rejection_reason)
  where id = p_execution_id;

  perform public.write_audit_log(
    'contract.execution_rejected', 'contract_execution', p_execution_id::text,
    jsonb_build_object('contract_document_id', v_execution.contract_document_id::text, 'status', 'REJECTED')
  );
  return json_build_object('execution_id', p_execution_id, 'status', 'REJECTED');
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Grants mínimos
-- -----------------------------------------------------------------------------
revoke execute on function public.list_contract_documents(uuid) from public, anon;
revoke execute on function public.get_contract_document_detail(uuid) from public, anon;
revoke execute on function public.list_contract_executions(uuid) from public, anon;
revoke execute on function public.get_contract_execution_detail(uuid) from public, anon;
revoke execute on function public.create_contract_document_draft(uuid,text,text,jsonb) from public, anon;
revoke execute on function public.create_contract_execution(uuid,text,uuid,text,timestamptz) from public, anon;
revoke execute on function public.reject_contract_execution(uuid,text) from public, anon;

grant execute on function public.list_contract_documents(uuid) to authenticated;
grant execute on function public.get_contract_document_detail(uuid) to authenticated;
grant execute on function public.list_contract_executions(uuid) to authenticated;
grant execute on function public.get_contract_execution_detail(uuid) to authenticated;
grant execute on function public.create_contract_document_draft(uuid,text,text,jsonb) to authenticated;
grant execute on function public.create_contract_execution(uuid,text,uuid,text,timestamptz) to authenticated;
grant execute on function public.reject_contract_execution(uuid,text) to authenticated;

revoke execute on function public._can_access_contract_document(uuid) from public, anon, authenticated;
revoke execute on function public._contract_id_for_document(uuid) from public, anon, authenticated;

commit;
