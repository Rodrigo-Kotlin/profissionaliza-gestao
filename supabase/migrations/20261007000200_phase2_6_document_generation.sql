-- FASE 2.6B2 — geração e finalização server-side do documento original.
-- Não implementa assinatura, upload de execução ou alteração de Contract SIGNED.

begin;

create or replace function public.get_or_create_contract_document_draft(
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
  v_document record;
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
    raise exception 'Only draft contracts can generate documents' using errcode = '22023';
  end if;
  if not public._can_access_contract_document(p_contract_id) then
    raise exception 'Not authorized to generate contract document' using errcode = '42501';
  end if;
  if p_document_payload is null or jsonb_typeof(p_document_payload) <> 'object' then
    raise exception 'Document payload must be a JSON object' using errcode = '22023';
  end if;
  if p_template_version is null or char_length(trim(p_template_version)) = 0 then
    raise exception 'Template version is required' using errcode = '22023';
  end if;

  select * into v_document
  from public.contract_documents
  where contract_id = p_contract_id and status = 'FINAL'
  order by version desc limit 1;
  if found then
    return json_build_object(
      'document_id', v_document.id, 'contract_id', v_document.contract_id,
      'document_code', v_document.document_code, 'version', v_document.version,
      'status', v_document.status, 'template_version', v_document.template_version,
      'original_file_name', v_document.original_file_name,
      'original_file_size', v_document.original_file_size,
      'original_sha256_prefix', left(v_document.original_sha256, 12),
      'generated_at', v_document.generated_at, 'issued_at', v_document.issued_at,
      'idempotent', true
    );
  end if;

  select * into v_document
  from public.contract_documents
  where contract_id = p_contract_id and status = 'DRAFT'
  order by version desc limit 1;
  if found then
    update public.contract_documents set
      document_type = upper(trim(p_document_type)),
      template_version = trim(p_template_version),
      document_payload = p_document_payload,
      generated_by = auth.uid()
    where id = v_document.id;

    return json_build_object(
      'document_id', v_document.id, 'contract_id', v_document.contract_id,
      'document_code', v_document.document_code, 'version', v_document.version,
      'status', 'DRAFT', 'template_version', trim(p_template_version), 'idempotent', true
    );
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.contract_documents where contract_id = p_contract_id;
  v_document_code := replace(v_contract.contract_code, 'CTR-', 'DOC-CTR-') || '-V' || lpad(v_version::text, 2, '0');

  insert into public.contract_documents (
    contract_id, document_code, version, document_type, status, template_version,
    document_payload, generated_by
  ) values (
    p_contract_id, v_document_code, v_version, upper(trim(p_document_type)), 'DRAFT',
    trim(p_template_version), p_document_payload, auth.uid()
  ) returning id into v_document_id;

  perform public.write_audit_log(
    'contract.document_draft_created', 'contract_document', v_document_id::text,
    jsonb_build_object(
      'contract_id', p_contract_id::text, 'document_code', v_document_code,
      'version', v_version, 'status', 'DRAFT'
    )
  );

  return json_build_object(
    'document_id', v_document_id, 'contract_id', p_contract_id,
    'document_code', v_document_code, 'version', v_version,
    'status', 'DRAFT', 'template_version', trim(p_template_version), 'idempotent', false
  );
end;
$$;

create or replace function public.finalize_contract_document(
  p_document_id uuid,
  p_document_payload jsonb,
  p_canonical_payload_hash text,
  p_original_file_path text,
  p_original_file_name text,
  p_original_file_size bigint,
  p_original_sha256 text
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_document record;
  v_expected_path text;
begin
  if auth.uid() is null or not public.has_permission('contracts.documents.generate') then
    raise exception 'Permission denied: contracts.documents.generate' using errcode = '42501';
  end if;

  select d.* into v_document from public.contract_documents d
  where d.id = p_document_id for update;
  if v_document is null then raise exception 'Document not found' using errcode = 'P0002'; end if;
  if not public._can_access_contract_document(v_document.contract_id) then
    raise exception 'Not authorized to finalize contract document' using errcode = '42501';
  end if;

  if v_document.status = 'FINAL' then
    return json_build_object(
      'document_id', v_document.id, 'contract_id', v_document.contract_id,
      'document_code', v_document.document_code, 'version', v_document.version,
      'status', v_document.status, 'template_version', v_document.template_version,
      'original_file_name', v_document.original_file_name,
      'original_file_size', v_document.original_file_size,
      'original_sha256_prefix', left(v_document.original_sha256, 12),
      'generated_at', v_document.generated_at, 'issued_at', v_document.issued_at,
      'idempotent', true
    );
  end if;
  if v_document.status <> 'DRAFT' then
    raise exception 'Only draft documents can be finalized' using errcode = '22023';
  end if;
  if p_document_payload is null or jsonb_typeof(p_document_payload) <> 'object' then
    raise exception 'Document payload must be a JSON object' using errcode = '22023';
  end if;

  v_expected_path := 'contracts/' || v_document.contract_id::text || '/v' || v_document.version::text || '/original.pdf';
  if p_original_file_path is distinct from v_expected_path then
    raise exception 'Invalid original document path' using errcode = '22023';
  end if;
  if p_original_file_name is distinct from 'original.pdf' or p_original_file_size is null or p_original_file_size <= 0 then
    raise exception 'Invalid original document metadata' using errcode = '22023';
  end if;
  if p_canonical_payload_hash is null or p_canonical_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid canonical payload hash' using errcode = '22023';
  end if;
  if p_original_sha256 is null or p_original_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid original document hash' using errcode = '22023';
  end if;

  update public.contract_documents set
    status = 'FINAL',
    document_payload = p_document_payload,
    canonical_payload_hash = p_canonical_payload_hash,
    original_file_path = p_original_file_path,
    original_file_name = p_original_file_name,
    original_mime_type = 'application/pdf',
    original_file_size = p_original_file_size,
    original_sha256 = p_original_sha256,
    generated_at = now(),
    generated_by = auth.uid(),
    issued_at = now()
  where id = p_document_id;

  perform public.write_audit_log(
    'contract.document_generated', 'contract_document', p_document_id::text,
    jsonb_build_object(
      'contract_id', v_document.contract_id::text, 'version', v_document.version,
      'document_code', v_document.document_code,
      'template_version', v_document.template_version,
      'hash_prefix', left(p_original_sha256, 12)
    )
  );
  perform public.write_audit_log(
    'contract.document_finalized', 'contract_document', p_document_id::text,
    jsonb_build_object(
      'contract_id', v_document.contract_id::text, 'version', v_document.version,
      'document_code', v_document.document_code,
      'template_version', v_document.template_version,
      'hash_prefix', left(p_original_sha256, 12)
    )
  );

  return json_build_object(
    'document_id', p_document_id, 'contract_id', v_document.contract_id,
    'document_code', v_document.document_code, 'version', v_document.version,
    'status', 'FINAL', 'template_version', v_document.template_version,
    'original_file_name', p_original_file_name, 'original_file_size', p_original_file_size,
    'original_sha256_prefix', left(p_original_sha256, 12), 'generated_at', now(),
    'issued_at', now(), 'idempotent', false
  );
end;
$$;

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
           left(original_sha256, 12) as original_sha256_prefix,
           generated_at, generated_by, issued_at, superseded_at,
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
  v_sensitive boolean;
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
  v_sensitive := public.has_permission('contracts.view_sensitive');

  select json_build_object(
    'document_id', d.id, 'contract_id', d.contract_id, 'document_code', d.document_code,
    'version', d.version, 'document_type', d.document_type, 'status', d.status,
    'template_version', d.template_version,
    'document_payload', case when v_sensitive then d.document_payload else null end,
    'canonical_payload_hash', case when v_sensitive then d.canonical_payload_hash else null end,
    'original_file_path', d.original_file_path, 'original_file_name', d.original_file_name,
    'original_mime_type', d.original_mime_type, 'original_file_size', d.original_file_size,
    'original_sha256_prefix', left(d.original_sha256, 12), 'generated_at', d.generated_at,
    'generated_by', d.generated_by, 'issued_at', d.issued_at, 'superseded_at', d.superseded_at,
    'previous_document_id', d.previous_document_id,
    'superseded_by_document_id', d.superseded_by_document_id,
    'created_at', d.created_at, 'updated_at', d.updated_at,
    'sensitive', v_sensitive
  ) into v_result
  from public.contract_documents d where d.id = p_document_id;
  return v_result;
end;
$$;

revoke execute on function public.get_or_create_contract_document_draft(uuid,text,text,jsonb) from public, anon;
revoke execute on function public.finalize_contract_document(uuid,jsonb,text,text,text,bigint,text) from public, anon;
grant execute on function public.get_or_create_contract_document_draft(uuid,text,text,jsonb) to authenticated;
grant execute on function public.finalize_contract_document(uuid,jsonb,text,text,text,bigint,text) to authenticated;

commit;
