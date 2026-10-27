-- FASE 2.8A.6.3 — CONTRACT SNAPSHOT COMPATIBILITY
-- Execute only after the migration is deployed. All business fixtures are rollback-only.
do $$
declare
  v_fn oid;
  v_column text;
  v_definition text;
  v_sales integer;
  v_contracts integer;
  v_nullable text;
  v_type text;
  v_draft integer;
  v_pending integer;
  v_signed integer;
begin
  select data_type, is_nullable into v_type, v_nullable
  from information_schema.columns
  where table_schema='public' and table_name='sales' and column_name='course_workload_snapshot';
  if v_type <> 'integer' or v_nullable <> 'YES' then
    raise exception 'Sale workload snapshot must be nullable integer';
  end if;
  select data_type, is_nullable into v_type, v_nullable
  from information_schema.columns
  where table_schema='public' and table_name='sales' and column_name='course_modality_snapshot';
  if v_type <> 'text' or v_nullable <> 'YES' then
    raise exception 'Sale modality snapshot must be nullable text';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='sales' and column_name='course_workload_snapshot') then
    raise exception 'Sale workload snapshot column missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='sales' and column_name='course_modality_snapshot') then
    raise exception 'Sale modality snapshot column missing';
  end if;
  foreach v_column in array array[
    'offer_code_snapshot','offer_name_snapshot','offer_type_snapshot','price_plan_code_snapshot',
    'commercial_payment_method_snapshot','pricing_model_snapshot','installment_count_commercial_snapshot',
    'installment_amount_snapshot','cash_price_snapshot','enrollment_fee_snapshot','total_amount_snapshot'
  ]::text[] loop
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='contracts' and column_name=v_column) then
      raise exception 'Contract snapshot column missing: %', v_column;
    end if;
    select is_nullable into v_nullable
    from information_schema.columns
    where table_schema='public' and table_name='contracts' and column_name=v_column;
    if v_nullable <> 'YES' then raise exception 'Contract snapshot must be nullable: %', v_column; end if;
  end loop;

  select p.oid, pg_get_functiondef(p.oid) into v_fn, v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='create_contract_from_sale'
    and pg_get_function_identity_arguments(p.oid) = 'p_sale_id uuid, p_contractor_person_id uuid, p_contract_notes text';
  if v_fn is null then raise exception 'Contract creation RPC missing'; end if;
  if lower(v_definition) not like '%security definer%' or lower(v_definition) not like '%set search_path%' or lower(v_definition) not like '%row_security%' then
    raise exception 'Contract creation RPC security contract changed';
  end if;
  if lower(v_definition) like '%course_offers%' or lower(v_definition) like '%price_plans%' then
    raise exception 'Contract creation RPC must not consult live commercial catalog';
  end if;
  if lower(v_definition) not like '%v_sale.net_value%' then raise exception 'Contract must consume Sale net_value'; end if;
  if lower(v_definition) not like '%course_workload_snapshot%' or lower(v_definition) not like '%course_modality_snapshot%' then
    raise exception 'Contract course snapshot flow missing';
  end if;
  if lower(v_definition) not like '%commercial sale snapshots are incomplete%' then raise exception 'Commercial completeness guard missing'; end if;
  if has_function_privilege('anon', v_fn, 'EXECUTE') or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Contract creation RPC grants changed';
  end if;

  if not exists (select 1 from pg_constraint where conrelid='public.contracts'::regclass and conname='contracts_sale_id_key') then
    raise exception 'One-contract-per-sale uniqueness missing';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.contracts'::regclass) then raise exception 'Contracts RLS disabled'; end if;
  if not (select relrowsecurity from pg_class where oid='public.sales'::regclass) then raise exception 'Sales RLS disabled'; end if;
  if exists (
    select 1 from pg_constraint
    where conrelid='public.contracts'::regclass
      and confrelid in ('public.course_offers'::regclass, 'public.price_plans'::regclass)
  ) then raise exception 'Contract must not have catalog foreign keys'; end if;
  select count(*) into v_sales from public.sales;
  select count(*) into v_contracts from public.contracts;
  if v_sales <> 15 then raise exception 'Historical sales count changed'; end if;
  if v_contracts <> 12 then raise exception 'Historical contracts count changed'; end if;
  if exists (select 1 from public.sales where offer_id is null and (course_workload_snapshot is not null or course_modality_snapshot is not null)) then
    raise exception 'Historical sales were modified';
  end if;
  if exists (select 1 from public.contracts where offer_code_snapshot is not null
    or offer_name_snapshot is not null or offer_type_snapshot is not null
    or price_plan_code_snapshot is not null or commercial_payment_method_snapshot is not null
    or pricing_model_snapshot is not null or installment_count_commercial_snapshot is not null
    or installment_amount_snapshot is not null or cash_price_snapshot is not null
    or enrollment_fee_snapshot is not null or total_amount_snapshot is not null) then
    raise exception 'Existing contracts were backfilled';
  end if;
  select count(*) filter (where status='DRAFT'), count(*) filter (where status='PENDING_SIGNATURE'),
    count(*) filter (where status='SIGNED') into v_draft, v_pending, v_signed
  from public.contracts;
  if v_draft <> 2 or v_pending <> 4 or v_signed <> 6 then raise exception 'Historical contract statuses changed'; end if;
  raise notice 'contract snapshot compatibility static smoke passed';
end;
$$;

do $$
declare
  v_fn oid;
  v_definition text;
begin
  select p.oid, pg_get_functiondef(p.oid) into v_fn, v_definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='create_sale_from_commercial_offer'
    and pg_get_function_identity_arguments(p.oid) = 'p_lead_id uuid, p_offer_id uuid, p_price_plan_id uuid, p_discount_value numeric, p_commercial_notes text';
  if v_fn is null then raise exception 'Commercial Sale RPC missing'; end if;
  if lower(v_definition) not like '%security definer%' or lower(v_definition) not like '%set search_path%' or lower(v_definition) not like '%row_security%' then
    raise exception 'Commercial Sale RPC security contract changed';
  end if;
  foreach v_definition in array array[
    'has_permission(''sales.create'')', 'for update', 'for share', 'offer_type <> ''COURSE''',
    'quantity-based price plans', 'discount value must be finite', 'student_status_history',
    'crm.lead_won', 'course_workload_snapshot', 'course_modality_snapshot'
  ]::text[] loop
    if lower(pg_get_functiondef(v_fn)) not like '%' || lower(v_definition) || '%' then
      raise exception 'Commercial Sale RPC protection/snapshot missing: %', v_definition;
    end if;
  end loop;
  if has_function_privilege('anon', v_fn, 'EXECUTE') or has_function_privilege('public', v_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Commercial Sale RPC grants changed';
  end if;
  raise notice 'commercial Sale RPC static smoke passed';
end;
$$;

-- Commercial, historical, CASH, explicit-installment, immutability, canceled-sale,
-- and duplicate-contract scenarios are executed with synthetic fixtures in a
-- transaction and must be run with the linked migration present. No fixture survives.
begin;
do $$
declare
  v_user uuid;
  v_person uuid;
  v_lead uuid;
  v_student uuid;
  v_sale uuid;
  v_incomplete_sale uuid;
  v_historical_sale uuid;
  v_historical_contract uuid;
  v_incomplete_lead uuid;
  v_historical_lead uuid;
  v_contract uuid;
  v_stage uuid;
  v_offer record;
  v_plan record;
  v_before record;
  v_after record;
  v_historical_before record;
  v_error text;
begin
  select seller_user_id into v_user from public.sales order by created_at limit 1;
  select id into v_stage from public.crm_pipeline_stages where code='NEGOTIATION';
  select o.*, p.id as plan_id, p.code as plan_code, p.payment_method as plan_payment_method,
    p.pricing_model as plan_pricing_model, p.installment_count, p.installment_amount,
    p.cash_price, p.enrollment_fee, p.total_amount
  into v_offer
  from public.course_offers o join public.price_plans p on p.offer_id=o.id
  join public.courses c on c.id=o.course_id
  where o.offer_type='COURSE' and o.status='ACTIVE' and p.status='ACTIVE'
    and o.valid_from <= now() and (o.valid_until is null or o.valid_until > now())
    and p.valid_from <= now() and (p.valid_until is null or p.valid_until > now())
    and p.quantity_min is null and p.quantity_max is null
  order by p.pricing_model, p.code limit 1;
  if v_user is null or v_stage is null or v_offer.id is null then raise exception 'No safe smoke fixtures available'; end if;
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  insert into public.people(full_name, created_by, updated_by) values ('SMOKE CONTRACT SNAPSHOT', v_user, v_user) returning id into v_person;
  insert into public.crm_leads(lead_code, person_id, stage_id, owner_user_id, status, temperature, created_by, updated_by)
    values ('SMOKE-CONTRACT-SNAPSHOT', v_person, v_stage, v_user, 'OPEN', 'HOT', v_user, v_user) returning id into v_lead;

  -- Existing catalog courses may legitimately have NULL workload. Prepare the
  -- fixture inside the transaction, then freeze it through the real Sale RPC.
  update public.courses set workload_hours=120 where id=v_offer.course_id;
  v_sale := (public.create_sale_from_commercial_offer(
    v_lead, v_offer.id, v_offer.plan_id, 0, 'snapshot smoke'
  )->>'sale_id')::uuid;

  insert into public.crm_leads(lead_code, person_id, stage_id, owner_user_id, status, temperature, created_by, updated_by)
    values ('SMOKE-CONTRACT-INCOMPLETE', v_person, v_stage, v_user, 'WON', 'HOT', v_user, v_user)
    returning id into v_incomplete_lead;
  insert into public.crm_leads(lead_code, person_id, stage_id, owner_user_id, status, temperature, created_by, updated_by)
    values ('SMOKE-CONTRACT-HISTORICAL', v_person, v_stage, v_user, 'WON', 'HOT', v_user, v_user)
    returning id into v_historical_lead;

  insert into public.sales(
    sale_code, lead_id, person_id, student_id, course_id, course_name_snapshot, course_price_snapshot,
    course_workload_snapshot, course_modality_snapshot, seller_user_id, sale_date, gross_value, discount_value,
    payment_method, installments, commercial_notes, offer_id, price_plan_id, offer_code_snapshot,
    offer_name_snapshot, offer_type_snapshot, price_plan_code_snapshot, payment_method_snapshot,
    pricing_model_snapshot, installment_count_snapshot, installment_amount_snapshot, cash_price_snapshot,
    enrollment_fee_snapshot, total_amount_snapshot, created_by, updated_by
  ) select
    'VND-SMOKE-INCOMPLETE', v_incomplete_lead, person_id, student_id, course_id, course_name_snapshot, course_price_snapshot,
    null, course_modality_snapshot, seller_user_id, sale_date, gross_value, discount_value,
    payment_method, installments, commercial_notes, offer_id, price_plan_id, offer_code_snapshot,
    offer_name_snapshot, offer_type_snapshot, price_plan_code_snapshot, payment_method_snapshot,
    pricing_model_snapshot, installment_count_snapshot, installment_amount_snapshot, cash_price_snapshot,
    enrollment_fee_snapshot, total_amount_snapshot, created_by, updated_by
  from public.sales where id=v_sale returning id into v_incomplete_sale;
  begin
    perform public.create_contract_from_sale(v_incomplete_sale, v_person, null);
    raise exception 'Incomplete commercial sale was accepted';
  exception when others then
    v_error:=sqlerrm;
    if v_error not like '%Commercial sale snapshots are incomplete%' then raise; end if;
  end;

  insert into public.sales(
    sale_code, lead_id, person_id, student_id, course_id, course_name_snapshot, course_price_snapshot,
    seller_user_id, sale_date, gross_value, discount_value, payment_method, installments,
    commercial_notes, created_by, updated_by
  ) select
    'VND-SMOKE-HISTORICAL', v_historical_lead, person_id, student_id, course_id, course_name_snapshot, course_price_snapshot,
    seller_user_id, sale_date, gross_value, discount_value, payment_method, installments,
    commercial_notes, created_by, updated_by
  from public.sales where id=v_sale returning id into v_historical_sale;
  v_historical_contract := (public.create_contract_from_sale(v_historical_sale, v_person, 'historical smoke')->>'contract_id')::uuid;
  select * into v_after from public.contracts where id=v_historical_contract;
  v_historical_before := v_after;
  if v_after.offer_code_snapshot is not null
     or v_after.course_workload_snapshot is distinct from (select workload_hours from public.courses where id=v_offer.course_id)
     or v_after.course_modality_snapshot is distinct from (select modality from public.courses where id=v_offer.course_id) then
    raise exception 'Historical contract fallback failed';
  end if;

  v_contract := (public.create_contract_from_sale(v_sale, v_person, 'snapshot smoke')->>'contract_id')::uuid;
  select * into v_before from public.contracts where id=v_contract;
  if v_before.net_value_snapshot <> (select net_value from public.sales where id=v_sale) then raise exception 'Net value did not come from Sale'; end if;
  if v_before.course_workload_snapshot is distinct from (select course_workload_snapshot from public.sales where id=v_sale)
     or v_before.course_modality_snapshot is distinct from (select course_modality_snapshot from public.sales where id=v_sale) then
    raise exception 'Contract course snapshots do not match Sale';
  end if;
  if v_offer.plan_payment_method='CASH' or v_offer.plan_pricing_model='CASH' then
    if v_before.commercial_payment_method_snapshot is distinct from v_offer.plan_payment_method
       or v_before.installment_count_commercial_snapshot is not null
       or v_before.installments_snapshot <> 1 then
      raise exception 'CASH commercial semantics failed';
    end if;
  elsif v_offer.installment_count is not null then
    if v_before.installment_count_commercial_snapshot is distinct from v_offer.installment_count
       or v_before.installment_amount_snapshot is distinct from v_offer.installment_amount then
      raise exception 'Explicit installment snapshot failed';
    end if;
  end if;

  update public.courses set name='SMOKE COURSE MUTATED', workload_hours=999, modality='ONLINE' where id=v_offer.course_id;
  update public.course_offers set name='SMOKE OFFER MUTATED', status='INACTIVE' where id=v_offer.id;
  update public.price_plans
  set cash_price=case when pricing_model='CASH' then 99999 else cash_price end,
      total_amount=case when pricing_model='CASH' then 99999 + coalesce(enrollment_fee, 0) else 99999 end,
      installment_amount=case when pricing_model='CASH' then null else 9999 end
  where id=v_offer.plan_id;
  select * into v_after from public.contracts where id=v_contract;
  if row_to_json(v_before)::jsonb - 'updated_at' <> row_to_json(v_after)::jsonb - 'updated_at' then raise exception 'Contract snapshots changed after catalog mutation'; end if;
  select * into v_after from public.contracts where id=v_historical_contract;
  if row_to_json(v_historical_before)::jsonb - 'updated_at' <> row_to_json(v_after)::jsonb - 'updated_at' then raise exception 'Historical contract changed after catalog mutation'; end if;

  begin perform public.create_contract_from_sale(v_sale, v_person, null); raise exception 'Duplicate contract was accepted'; exception when others then v_error:=sqlerrm; if v_error not like '%Contract already exists%' then raise; end if; end;
  update public.sales set status='CANCELED', canceled_at=now(), canceled_by=v_user, cancellation_reason='smoke' where id=v_sale;
  begin perform public.create_contract_from_sale(v_sale, v_person, null); raise exception 'Canceled sale was accepted'; exception when others then v_error:=sqlerrm; if v_error not like '%Only confirmed sales%' then raise; end if; end;
end;
$$;
rollback;
