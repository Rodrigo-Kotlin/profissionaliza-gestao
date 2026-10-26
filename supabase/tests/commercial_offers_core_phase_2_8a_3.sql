-- FASE 2.8A.3 — smoke test read-only do núcleo comercial.
-- Executar após aplicar a migration em ambiente seguro; não cria dados.

do $$
declare
  v_table text;
  v_column text;
  v_expected_tables constant text[] := array[
    'course_offers', 'offer_items', 'price_plans', 'price_plan_installments'
  ];
begin
  foreach v_table in array v_expected_tables loop
    if to_regclass('public.' || v_table) is null then
      raise exception 'Missing commercial table %', v_table;
    end if;
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = v_table) then
      raise exception 'RLS is disabled for %', v_table;
    end if;
    if has_table_privilege('authenticated', 'public.' || v_table, 'SELECT')
       or has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || v_table, 'DELETE') then
      raise exception 'Direct authenticated table privilege exists for %', v_table;
    end if;
  end loop;

  foreach v_column in array array['id','code','name','course_id','offer_type','status','valid_from','valid_until','created_at','created_by','updated_at','updated_by'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_offers' and column_name = v_column) then raise exception 'Missing course_offers column %', v_column; end if;
  end loop;
  foreach v_column in array array['id','offer_id','course_id','selection_mode','min_quantity','max_quantity','sort_order','created_at'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'offer_items' and column_name = v_column) then raise exception 'Missing offer_items column %', v_column; end if;
  end loop;
  foreach v_column in array array['id','code','offer_id','payment_method','pricing_model','cash_price','enrollment_fee','installment_count','installment_amount','total_amount','quantity_min','quantity_max','status','valid_from','valid_until','created_at','created_by','updated_at','updated_by'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'price_plans' and column_name = v_column) then raise exception 'Missing price_plans column %', v_column; end if;
  end loop;
  foreach v_column in array array['id','price_plan_id','installment_number','due_offset_days','amount','created_at'] loop
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'price_plan_installments' and column_name = v_column) then raise exception 'Missing price_plan_installments column %', v_column; end if;
  end loop;

  if (select count(*) from pg_constraint where conname in (
    'course_offers_course_relation_check','course_offers_validity_check',
    'offer_items_offer_course_unique','offer_items_quantity_range_check',
    'price_plans_cash_model_check','price_plans_installment_model_check',
    'price_plans_card_model_check','price_plans_quantity_model_check',
    'price_plans_validity_check','price_plan_installments_unique',
    'price_plan_installments_amount_check','price_plan_installments_due_offset_check'
  )) <> 12 then
    raise exception 'Commercial constraints are incomplete';
  end if;

  if (select count(*) from public.course_offers) <> 0
     or (select count(*) from public.offer_items) <> 0
     or (select count(*) from public.price_plans) <> 0
     or (select count(*) from public.price_plan_installments) <> 0 then
    raise exception 'Commercial core must not seed data in Phase 2.8A.3';
  end if;

  if not has_function_privilege('authenticated', 'public.list_course_offers(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_price_plans(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_course_offer(text,text,uuid,text,timestamptz,timestamptz)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_course_offer(uuid,text,uuid,text,timestamptz,timestamptz)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.activate_course_offer(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.deactivate_course_offer(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.create_price_plan(text,uuid,text,text,numeric,numeric,numeric,integer,numeric,integer,integer,timestamptz,timestamptz)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_price_plan(uuid,text,text,numeric,numeric,numeric,integer,numeric,integer,integer,timestamptz,timestamptz)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.activate_price_plan(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.deactivate_price_plan(uuid)', 'EXECUTE') then
    raise exception 'Commercial RPC grants are incomplete';
  end if;
  if has_function_privilege('anon', 'public.list_course_offers(text)', 'EXECUTE')
     or has_function_privilege('public', 'public.list_course_offers(text)', 'EXECUTE')
     or exists (select 1 from pg_proc where proname = 'approve_price_plan') then
    raise exception 'Unexpected anonymous/public RPC grant or approve workflow';
  end if;

  if (select count(*) from public.permissions where code in (
    'course_offers.view','course_offers.manage','course_offers.activate',
    'price_plans.view','price_plans.manage','price_plans.activate'
  )) <> 6 then
    raise exception 'Commercial permissions are incomplete';
  end if;
  if exists (select 1 from public.permissions where code = 'price_plans.approve') then
    raise exception 'Approval permission must not exist without an approval workflow';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'price_plans_prevent_active_overlap')
     or not exists (select 1 from pg_trigger where tgname = 'price_plan_installments_validate') then
    raise exception 'Commercial integrity triggers are missing';
  end if;
end
$$;

-- Runtime authenticated tests for create/update/activate and audit logging must
-- run with a QA identity and rollback wrapper; this file intentionally remains
-- read-only and does not manufacture users, offers, plans, or prices.
