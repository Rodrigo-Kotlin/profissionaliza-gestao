-- FASE 2.6B1 — smoke estrutural, sem criar documentos ou executions reais.
begin;

do $$
declare
  v_bucket_public boolean;
  v_document_count integer;
  v_execution_count integer;
begin
  select public into v_bucket_public
  from storage.buckets
  where id = 'contract-documents';
  if not found or v_bucket_public is distinct from false then
    raise exception 'contract-documents bucket must exist and be private';
  end if;

  select count(*) into v_document_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'contract_documents';
  if v_document_count < 22 then
    raise exception 'contract_documents schema is incomplete';
  end if;

  select count(*) into v_execution_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'contract_executions';
  if v_execution_count < 24 then
    raise exception 'contract_executions schema is incomplete';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'contract_documents'
      and indexname = 'contract_documents_contract_version_uidx'
  ) then
    raise exception 'contract document version uniqueness is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contract_documents_status_check'
  ) then
    raise exception 'contract document status constraint is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contract_executions_method_check'
  ) then
    raise exception 'contract execution method constraint is missing';
  end if;

  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('contract_documents', 'contract_executions')
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'document tables must remain RPC-only';
  end if;
end;
$$;

rollback;
