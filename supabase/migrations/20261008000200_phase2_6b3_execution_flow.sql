-- FASE 2.6B3 — recebimento, conferência e formalização de execuções.
-- GOV_BR/PHYSICAL only; no external provider or automatic signature validation.
begin;

alter table public.contract_executions
  drop constraint if exists contract_executions_file_size_check;
alter table public.contract_executions
  add constraint contract_executions_file_size_check
  check (signed_file_size is null or signed_file_size between 1 and 20971520);

alter table public.contract_executions
  drop constraint if exists contract_executions_received_fields_check;
alter table public.contract_executions
  add constraint contract_executions_received_fields_check check (
    status not in ('RECEIVED', 'VERIFIED') or (
      signed_file_path is not null and char_length(trim(signed_file_path)) > 0 and
      signed_file_name is not null and char_length(trim(signed_file_name)) > 0 and
      signed_mime_type = 'application/pdf' and
      signed_file_size is not null and signed_file_size between 1 and 20971520 and
      signed_sha256 is not null and signed_sha256 ~ '^[0-9a-f]{64}$' and
      received_at is not null and
      received_by is not null
    )
  );

create unique index if not exists contract_executions_active_method_uidx
  on public.contract_executions(contract_document_id, execution_method)
  where status in ('PENDING_UPLOAD', 'RECEIVED', 'VERIFIED');

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
  v_contract record;
  v_document record;
  v_existing record;
  v_execution_id uuid;
begin
  if auth.uid() is null or not public.has_permission('contracts.execution.upload') then
    raise exception 'Permission denied: contracts.execution.upload' using errcode = '42501';
  end if;
  if p_execution_method not in ('GOV_BR', 'PHYSICAL') then
    raise exception 'Execution method is not implemented in this phase' using errcode = '22023';
  end if;
  if p_execution_method = 'PHYSICAL' and p_signed_at is null then
    raise exception 'Physical execution requires signed_at' using errcode = '22023';
  end if;

  select d.*, c.status as contract_status, c.contractor_person_id, c.contractor_name_snapshot
  into v_document
  from public.contract_documents d
  join public.contracts c on c.id = d.contract_id
  where d.id = p_contract_document_id
  for update;
  if v_document is null then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if v_document.status <> 'FINAL' then
    raise exception 'Only final documents can be formalized' using errcode = '22023';
  end if;
  if v_document.contract_status = 'CANCELED' then
    raise exception 'Canceled contracts cannot be formalized' using errcode = '22023';
  end if;
  if not public._can_access_contract_document(v_document.contract_id) then
    raise exception 'Not authorized to create contract execution' using errcode = '42501';
  end if;
  if p_signer_person_id is not null and p_signer_person_id is distinct from v_document.contractor_person_id then
    raise exception 'Signer does not match contract contractor' using errcode = '22023';
  end if;
  if p_signer_name_snapshot is not null and trim(p_signer_name_snapshot) is distinct from v_document.contractor_name_snapshot then
    raise exception 'Signer name does not match contract snapshot' using errcode = '22023';
  end if;
  if p_signed_at is not null and p_signed_at > now() then
    raise exception 'Signed date cannot be in the future' using errcode = '22023';
  end if;

  select * into v_existing
  from public.contract_executions
  where contract_document_id = p_contract_document_id
    and execution_method = p_execution_method
    and status in ('PENDING_UPLOAD', 'RECEIVED', 'VERIFIED')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    return json_build_object(
      'execution_id', v_existing.id,
      'contract_document_id', v_existing.contract_document_id,
      'execution_method', v_existing.execution_method,
      'status', v_existing.status,
      'created', false
    );
  end if;

  insert into public.contract_executions (
    contract_document_id, execution_method, status, signer_person_id,
    signer_name_snapshot, signed_at
  ) values (
    p_contract_document_id, p_execution_method, 'PENDING_UPLOAD',
    v_document.contractor_person_id, v_document.contractor_name_snapshot,
    p_signed_at
  ) returning id into v_execution_id;

  perform public.write_audit_log(
    'contract.execution_created', 'contract_execution', v_execution_id::text,
    jsonb_build_object(
      'contract_document_id', p_contract_document_id::text,
      'execution_method', p_execution_method,
      'status', 'PENDING_UPLOAD'
    )
  );

  return json_build_object(
    'execution_id', v_execution_id,
    'contract_document_id', p_contract_document_id,
    'execution_method', p_execution_method,
    'status', 'PENDING_UPLOAD',
    'created', true
  );
end;
$$;

create or replace function public.receive_contract_execution(
  p_execution_id uuid,
  p_signed_file_path text,
  p_signed_file_name text,
  p_signed_file_size bigint,
  p_signed_sha256 text,
  p_signed_at timestamptz default null,
  p_evidence_json jsonb default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_execution record;
  v_expected_path text;
begin
  if auth.uid() is null or not public.has_permission('contracts.execution.upload') then
    raise exception 'Permission denied: contracts.execution.upload' using errcode = '42501';
  end if;
  select e.*, d.contract_id, d.version as document_version, d.status as document_status,
         c.status as contract_status
  into v_execution
  from public.contract_executions e
  join public.contract_documents d on d.id = e.contract_document_id
  join public.contracts c on c.id = d.contract_id
  where e.id = p_execution_id
  for update;
  if v_execution is null then raise exception 'Execution not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_execution.contract_id) then
    raise exception 'Not authorized to receive contract execution' using errcode = '42501';
  end if;
  if v_execution.status <> 'PENDING_UPLOAD' then
    raise exception 'Only pending executions can receive a file' using errcode = '22023';
  end if;
  if v_execution.document_status <> 'FINAL' or v_execution.contract_status = 'CANCELED' then
    raise exception 'Execution document is not available' using errcode = '22023';
  end if;
  if v_execution.execution_method not in ('GOV_BR', 'PHYSICAL') then
    raise exception 'Execution method is not implemented in this phase' using errcode = '22023';
  end if;
  if p_signed_at is not null and p_signed_at > now() then
    raise exception 'Signed date cannot be in the future' using errcode = '22023';
  end if;
  if v_execution.execution_method = 'PHYSICAL' and coalesce(p_signed_at, v_execution.signed_at) is null then
    raise exception 'Physical execution requires signed_at' using errcode = '22023';
  end if;
  if p_signed_file_name is null or char_length(trim(p_signed_file_name)) not between 1 and 240 then
    raise exception 'Signed file name is invalid' using errcode = '22023';
  end if;
  if p_signed_file_size is null or p_signed_file_size not between 1 and 20971520 then
    raise exception 'Signed file size is invalid' using errcode = '22023';
  end if;
  if p_signed_sha256 is null or p_signed_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Signed file SHA-256 is invalid' using errcode = '22023';
  end if;
  v_expected_path := format(
    'contracts/%s/v%s/executions/%s/signed.pdf',
    v_execution.contract_id, v_execution.document_version, v_execution.id
  );
  if p_signed_file_path is distinct from v_expected_path then
    raise exception 'Signed file path is invalid' using errcode = '22023';
  end if;
  if p_evidence_json is not null and jsonb_typeof(p_evidence_json) <> 'object' then
    raise exception 'Evidence must be a JSON object' using errcode = '22023';
  end if;
  if p_evidence_json is not null and octet_length(p_evidence_json::text) > 4096 then
    raise exception 'Evidence is too large' using errcode = '22023';
  end if;
  if p_evidence_json is not null and (
    p_evidence_json::text ~* '"(token|access_token|refresh_token|cookie|html)"\s*:'
    or p_evidence_json::text ~* '<\s*(html|script|!doctype)'
  ) then
    raise exception 'Sensitive external evidence is not allowed' using errcode = '22023';
  end if;

  update public.contract_executions set
    status = 'RECEIVED',
    signed_file_path = p_signed_file_path,
    signed_file_name = trim(p_signed_file_name),
    signed_mime_type = 'application/pdf',
    signed_file_size = p_signed_file_size,
    signed_sha256 = p_signed_sha256,
    signed_at = coalesce(p_signed_at, signed_at),
    received_at = now(),
    received_by = auth.uid(),
    evidence_json = p_evidence_json,
    updated_at = now()
  where id = p_execution_id;

  perform public.write_audit_log(
    'contract.execution_received', 'contract_execution', p_execution_id::text,
    jsonb_build_object(
      'contract_document_id', v_execution.contract_document_id::text,
      'execution_method', v_execution.execution_method,
      'status', 'RECEIVED',
      'signed_file_size', p_signed_file_size,
      'signed_sha256_prefix', left(p_signed_sha256, 12)
    )
  );
  return json_build_object(
    'execution_id', p_execution_id,
    'status', 'RECEIVED',
    'signed_file_name', trim(p_signed_file_name),
    'signed_file_size', p_signed_file_size,
    'signed_sha256', p_signed_sha256,
    'signed_sha256_prefix', left(p_signed_sha256, 12),
    'received_at', now()
  );
end;
$$;

create or replace function public.verify_contract_execution(
  p_execution_id uuid,
  p_verification_method text,
  p_verification_notes text default null,
  p_signed_at timestamptz default null,
  p_evidence_json jsonb default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_execution record;
  v_storage record;
  v_signed_at timestamptz;
begin
  if auth.uid() is null or not public.has_permission('contracts.execution.verify') then
    raise exception 'Permission denied: contracts.execution.verify' using errcode = '42501';
  end if;
  select e.*, d.contract_id, d.status as document_status, c.status as contract_status
  into v_execution
  from public.contract_executions e
  join public.contract_documents d on d.id = e.contract_document_id
  join public.contracts c on c.id = d.contract_id
  where e.id = p_execution_id
  for update;
  if v_execution is null then raise exception 'Execution not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_execution.contract_id) then
    raise exception 'Not authorized to verify contract execution' using errcode = '42501';
  end if;
  if v_execution.status <> 'RECEIVED' then
    raise exception 'Only received executions can be verified' using errcode = '22023';
  end if;
  if v_execution.document_status <> 'FINAL' or v_execution.contract_status = 'CANCELED' then
    raise exception 'Execution document is not available' using errcode = '22023';
  end if;
  if v_execution.signed_file_path is null or v_execution.signed_sha256 is null then
    raise exception 'Received execution has no file evidence' using errcode = '22023';
  end if;
  if v_execution.execution_method not in ('GOV_BR', 'PHYSICAL') then
    raise exception 'Execution method is not implemented in this phase' using errcode = '22023';
  end if;
  select o.metadata into v_storage
  from storage.objects o
  where o.bucket_id = 'contract-documents' and o.name = v_execution.signed_file_path;
  if v_storage is null then
    raise exception 'Signed file is not present in storage' using errcode = 'P0002';
  end if;
  if coalesce(v_storage.metadata->>'mimetype', 'application/pdf') <> 'application/pdf' then
    raise exception 'Signed file MIME type is not PDF' using errcode = '22023';
  end if;
  if v_storage.metadata ? 'size' and (v_storage.metadata->>'size')::bigint <> v_execution.signed_file_size then
    raise exception 'Signed file size does not match metadata' using errcode = '22023';
  end if;
  if v_storage.metadata ? 'sha256' and (v_storage.metadata->>'sha256') <> v_execution.signed_sha256 then
    raise exception 'Signed file SHA-256 does not match metadata' using errcode = '22023';
  end if;
  if p_verification_method not in ('GOV_BR_VALIDAR_MANUAL', 'PHYSICAL_IN_PERSON') then
    raise exception 'Verification method is invalid' using errcode = '22023';
  end if;
  if v_execution.execution_method = 'GOV_BR' and p_verification_method <> 'GOV_BR_VALIDAR_MANUAL' then
    raise exception 'GOV_BR execution requires manual ITI verification' using errcode = '22023';
  end if;
  if v_execution.execution_method = 'PHYSICAL' and p_verification_method <> 'PHYSICAL_IN_PERSON' then
    raise exception 'Physical execution requires in-person verification' using errcode = '22023';
  end if;
  if p_verification_notes is not null and char_length(trim(p_verification_notes)) > 2000 then
    raise exception 'Verification notes are too long' using errcode = '22023';
  end if;
  if p_evidence_json is not null and jsonb_typeof(p_evidence_json) <> 'object' then
    raise exception 'Evidence must be a JSON object' using errcode = '22023';
  end if;
  if p_evidence_json is not null and octet_length(p_evidence_json::text) > 4096 then
    raise exception 'Evidence is too large' using errcode = '22023';
  end if;
  if p_evidence_json::text ~* '"(token|access_token|refresh_token|cookie|html)"\s*:'
     or p_evidence_json::text ~* '<\s*(html|script|!doctype)' then
    raise exception 'Sensitive external evidence is not allowed' using errcode = '22023';
  end if;
  v_signed_at := coalesce(p_signed_at, v_execution.signed_at);
  if v_signed_at is null then
    raise exception 'Signed date is required for verification' using errcode = '22023';
  end if;
  if v_signed_at > now() then
    raise exception 'Signed date cannot be in the future' using errcode = '22023';
  end if;

  update public.contract_executions set
    status = 'VERIFIED',
    signed_at = v_signed_at,
    verified_at = now(),
    verified_by = auth.uid(),
    verification_method = trim(p_verification_method),
    verification_notes = nullif(trim(p_verification_notes), ''),
    evidence_json = coalesce(p_evidence_json, evidence_json),
    updated_at = now()
  where id = p_execution_id;

  perform public.write_audit_log(
    'contract.execution_verified', 'contract_execution', p_execution_id::text,
    jsonb_build_object(
      'contract_document_id', v_execution.contract_document_id::text,
      'execution_method', v_execution.execution_method,
      'verification_method', trim(p_verification_method),
      'status', 'VERIFIED',
      'signed_sha256_prefix', left(v_execution.signed_sha256, 12)
    )
  );
  return json_build_object(
    'execution_id', p_execution_id,
    'status', 'VERIFIED',
    'verification_method', trim(p_verification_method),
    'verified_at', now()
  );
end;
$$;

create or replace function public.complete_contract_from_verified_execution(
  p_execution_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_execution record;
  v_contract record;
  v_enrollment json;
begin
  if auth.uid() is null or not public.has_permission('contracts.mark_signed') then
    raise exception 'Permission denied: contracts.mark_signed' using errcode = '42501';
  end if;
  select e.*, d.contract_id, d.status as document_status, d.version as document_version,
         c.contract_code, c.status as contract_status
  into v_execution
  from public.contract_executions e
  join public.contract_documents d on d.id = e.contract_document_id
  join public.contracts c on c.id = d.contract_id
  where e.id = p_execution_id
  for update;
  if v_execution is null then raise exception 'Execution not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_execution.contract_id) then
    raise exception 'Not authorized to complete contract' using errcode = '42501';
  end if;
  if v_execution.status <> 'VERIFIED' then
    raise exception 'Only verified executions can complete contracts' using errcode = '22023';
  end if;
  if v_execution.document_status <> 'FINAL' then
    raise exception 'Only final documents can complete contracts' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.contract_documents newer
    where newer.contract_id = v_execution.contract_id
      and newer.status = 'FINAL'
      and newer.version > v_execution.document_version
  ) then
    raise exception 'Execution is not for the current final document' using errcode = '22023';
  end if;
  select * into v_contract from public.contracts where id = v_execution.contract_id for update;
  if v_contract.status = 'SIGNED' then
    v_enrollment := public._create_enrollment_from_signed_contract(v_contract.id);
    return json_build_object('contract_id', v_contract.id, 'contract_code', v_contract.contract_code,
      'status', 'SIGNED', 'execution_id', p_execution_id, 'enrollment', v_enrollment, 'created', false);
  end if;
  if v_contract.status <> 'PENDING_SIGNATURE' then
    raise exception 'Only pending signature contracts can be completed' using errcode = '22023';
  end if;

  update public.contracts set
    status = 'SIGNED', signed_at = coalesce(v_execution.signed_at, now()),
    signature_confirmed_by = auth.uid(), updated_by = auth.uid()
  where id = v_contract.id;

  perform public.write_audit_log(
    'contracts.signed', 'contract', v_contract.id::text,
    jsonb_build_object('contract_code', v_contract.contract_code, 'previous_status', 'PENDING_SIGNATURE',
      'new_status', 'SIGNED', 'execution_id', p_execution_id::text, 'execution_method', v_execution.execution_method)
  );
  v_enrollment := public._create_enrollment_from_signed_contract(v_contract.id);
  return json_build_object('contract_id', v_contract.id, 'contract_code', v_contract.contract_code,
    'status', 'SIGNED', 'execution_id', p_execution_id, 'enrollment', v_enrollment, 'created', true);
end;
$$;

create or replace function public.mark_contract_signed(p_contract_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
  v_enrollment json;
begin
  if auth.uid() is null or not public.has_permission('contracts.mark_signed') then
    raise exception 'Permission denied: contracts.mark_signed' using errcode = '42501';
  end if;
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contract not found' using errcode = 'P0002'; end if;
  if v_contract.status = 'SIGNED' then
    v_enrollment := public._create_enrollment_from_signed_contract(p_contract_id);
    return json_build_object('contract_id', p_contract_id, 'contract_code', v_contract.contract_code,
      'status', 'SIGNED', 'enrollment', v_enrollment, 'created', false);
  end if;
  raise exception 'Contract formalization requires a VERIFIED execution' using errcode = '22023';
end;
$$;

revoke execute on function public.receive_contract_execution(uuid,text,text,bigint,text,timestamptz,jsonb) from public, anon;
revoke execute on function public.verify_contract_execution(uuid,text,text,timestamptz,jsonb) from public, anon;
revoke execute on function public.complete_contract_from_verified_execution(uuid) from public, anon;
grant execute on function public.receive_contract_execution(uuid,text,text,bigint,text,timestamptz,jsonb) to authenticated;
grant execute on function public.verify_contract_execution(uuid,text,text,timestamptz,jsonb) to authenticated;
grant execute on function public.complete_contract_from_verified_execution(uuid) to authenticated;

commit;
