-- Read-only smoke test for FASE 2.8A.6.1.
-- Execute against the linked database only after the migration is deployed.

do $$
declare
  v_missing text[];
  v_nullable_bad integer;
  v_legacy_bad integer;
  v_rls boolean;
  v_forced boolean;
begin
  select array_agg(column_name order by column_name)
    into v_missing
  from (values
    ('offer_id'), ('price_plan_id'), ('offer_code_snapshot'), ('offer_name_snapshot'),
    ('offer_type_snapshot'), ('price_plan_code_snapshot'), ('payment_method_snapshot'),
    ('pricing_model_snapshot'), ('installment_count_snapshot'), ('installment_amount_snapshot'),
    ('quantity_min_snapshot'), ('quantity_max_snapshot'), ('cash_price_snapshot'),
    ('enrollment_fee_snapshot'), ('total_amount_snapshot')
  ) expected(column_name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'sales'
      and c.column_name = expected.column_name
  );
  if v_missing is not null then raise exception 'Missing sales columns: %', v_missing; end if;

  select count(*) into v_nullable_bad
  from information_schema.columns
  where table_schema = 'public' and table_name = 'sales'
    and column_name in (
      'offer_id','price_plan_id','offer_code_snapshot','offer_name_snapshot',
      'offer_type_snapshot','price_plan_code_snapshot','payment_method_snapshot',
      'pricing_model_snapshot','installment_count_snapshot','installment_amount_snapshot',
      'quantity_min_snapshot','quantity_max_snapshot','cash_price_snapshot',
      'enrollment_fee_snapshot','total_amount_snapshot'
    ) and is_nullable <> 'YES';
  if v_nullable_bad <> 0 then raise exception 'Commercial columns must be nullable'; end if;

  if not exists (select 1 from pg_constraint where conname = 'sales_offer_id_fkey' and confdeltype = 'r') then
    raise exception 'offer_id FK missing or not RESTRICT';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sales_price_plan_id_fkey' and confdeltype = 'r') then
    raise exception 'price_plan_id FK missing or not RESTRICT';
  end if;

  if (select count(*) from pg_constraint where conname in (
    'sales_offer_price_plan_pair_check',
    'sales_installment_count_snapshot_check',
    'sales_installment_amount_snapshot_check',
    'sales_cash_price_snapshot_check',
    'sales_enrollment_fee_snapshot_check',
    'sales_total_amount_snapshot_check',
    'sales_quantity_min_snapshot_check',
    'sales_quantity_max_snapshot_check',
    'sales_quantity_snapshot_range_check'
  )) <> 9 then
    raise exception 'Snapshot numeric constraints are incomplete';
  end if;
  if (select count(*) from pg_constraint
      where conname in (
        'sales_installment_amount_snapshot_check',
        'sales_cash_price_snapshot_check',
        'sales_enrollment_fee_snapshot_check',
        'sales_total_amount_snapshot_check'
      ) and pg_get_constraintdef(oid) ilike '%infinity%') <> 4 then
    raise exception 'Snapshot NUMERIC constraints must reject special values';
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'sales_offer_id_idx') then
    raise exception 'sales_offer_id_idx missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'sales_price_plan_id_idx') then
    raise exception 'sales_price_plan_id_idx missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'sales_offer_id_idx'
      and indexdef ilike '%where (offer_id is not null)%'
  ) then raise exception 'sales_offer_id_idx must be partial'; end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'sales_price_plan_id_idx'
      and indexdef ilike '%where (price_plan_id is not null)%'
  ) then raise exception 'sales_price_plan_id_idx must be partial'; end if;

  select c.relrowsecurity, c.relforcerowsecurity into v_rls, v_forced
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'sales';
  if not v_rls or v_forced then raise exception 'sales RLS architecture changed'; end if;
  if exists (
    select 1 from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'sales'
  ) then raise exception 'Direct sales policies must remain absent'; end if;

  if exists (select 1 from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'sales'
      and grantee in ('anon','authenticated')) then
    raise exception 'Direct sales grants must remain revoked';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_sales'
      and pg_get_function_identity_arguments(p.oid) = 'text, text, uuid, uuid, date, date, integer, integer'
      and p.prosecdef and 'search_path=pg_catalog, public' = any(p.proconfig)
      and 'row_security=off' = any(p.proconfig)
  ) then raise exception 'list_sales security contract changed'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_sale_detail'
      and pg_get_function_identity_arguments(p.oid) = 'uuid'
      and p.prosecdef and 'search_path=pg_catalog, public' = any(p.proconfig)
      and 'row_security=off' = any(p.proconfig)
  ) then raise exception 'get_sale_detail security contract changed'; end if;

  select count(*) into v_legacy_bad
  from public.sales
  where offer_id is not null or price_plan_id is not null
    or offer_code_snapshot is not null or offer_name_snapshot is not null
    or offer_type_snapshot is not null or price_plan_code_snapshot is not null
    or payment_method_snapshot is not null or pricing_model_snapshot is not null
    or installment_count_snapshot is not null or installment_amount_snapshot is not null
    or quantity_min_snapshot is not null or quantity_max_snapshot is not null
    or cash_price_snapshot is not null or enrollment_fee_snapshot is not null
    or total_amount_snapshot is not null;
  if v_legacy_bad <> 0 then raise exception 'Historical sales were backfilled'; end if;

  if (select count(*) from public.sales) <> 15 then raise exception 'Historical sales count changed'; end if;
  if exists (select 1 from public.sales where course_id is null or course_name_snapshot is null
    or gross_value is null or discount_value is null or net_value is null
    or payment_method is null or installments is null) then
    raise exception 'Historical legacy sale fields changed';
  end if;
  if (select count(*) from public.sales s join public.courses c on c.id = s.course_id where c.code = 'PROF-0001') <> 13
    or (select count(*) from public.sales s join public.courses c on c.id = s.course_id where c.code = 'PROF-0002') <> 2 then
    raise exception 'Legacy sales distribution changed';
  end if;
  if (select count(*) from public.sales where status = 'CONFIRMED' and payment_method = 'PIX' and installments = 1 and discount_value = 0 and net_value = gross_value) <> 15 then
    raise exception 'Historical commercial fields changed';
  end if;
  raise notice 'sales commercial snapshot core smoke passed';
end;
$$;
