-- FASE 2.6B3 — smoke estrutural, sem criar arquivos ou alterar contratos.
begin;

do $$
declare
  v_function_count integer;
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'contract_executions'
      and indexname = 'contract_executions_active_method_uidx'
  ) then
    raise exception 'active execution idempotency index is missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'contract_executions_received_fields_check'
  ) then
    raise exception 'received execution evidence constraint is missing';
  end if;

  select count(*) into v_function_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'receive_contract_execution',
      'verify_contract_execution',
      'complete_contract_from_verified_execution'
    );
  if v_function_count <> 3 then
    raise exception 'B3 execution RPCs are incomplete';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'mark_contract_signed'
      and pg_get_functiondef(p.oid) like '%requires a VERIFIED execution%'
  ) then
    raise exception 'direct contract signing guard is missing';
  end if;
end;
$$;

rollback;
