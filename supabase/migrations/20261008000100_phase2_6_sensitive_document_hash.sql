-- Fase 2.6H: permite o cross-check do PDF somente para usuários com acesso sensível.
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

  select contract_id into v_contract_id
  from public.contract_documents
  where id = p_document_id;
  if v_contract_id is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  if not public._can_access_contract_document(v_contract_id) then
    raise exception 'Not authorized to view contract document' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('contracts.view_sensitive');
  select json_build_object(
    'document_id', d.id,
    'contract_id', d.contract_id,
    'document_code', d.document_code,
    'version', d.version,
    'document_type', d.document_type,
    'status', d.status,
    'template_version', d.template_version,
    'document_payload', case when v_sensitive then d.document_payload else null end,
    'canonical_payload_hash', case when v_sensitive then d.canonical_payload_hash else null end,
    'original_file_path', d.original_file_path,
    'original_file_name', d.original_file_name,
    'original_file_mime_type', d.original_mime_type,
    'original_mime_type', d.original_mime_type,
    'original_file_size', d.original_file_size,
    'original_sha256', case when v_sensitive then d.original_sha256 else null end,
    'original_sha256_prefix', left(d.original_sha256, 12),
    'generated_at', d.generated_at,
    'generated_by', d.generated_by,
    'issued_at', d.issued_at,
    'superseded_at', d.superseded_at,
    'previous_document_id', d.previous_document_id,
    'superseded_by_document_id', d.superseded_by_document_id,
    'created_at', d.created_at,
    'updated_at', d.updated_at,
    'sensitive', v_sensitive
  ) into v_result
  from public.contract_documents d
  where d.id = p_document_id;
  return v_result;
end;
$$;

revoke execute on function public.get_contract_document_detail(uuid) from public, anon;
grant execute on function public.get_contract_document_detail(uuid) to authenticated;
