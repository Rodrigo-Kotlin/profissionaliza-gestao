-- Read-only smoke test for FASE 2.8A.6.2.
-- No sale is created by this smoke test.
do $$
declare
  v_fn oid;
  v_definition text;
  v_lower_definition text;
  v_sales integer;
  v_legacy_refs integer;
begin
  select p.oid, pg_get_functiondef(p.oid)
    into v_fn, v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_sale_from_commercial_offer'
    and pg_get_function_identity_arguments(p.oid) = 'p_lead_id uuid, p_offer_id uuid, p_price_plan_id uuid, p_discount_value numeric, p_commercial_notes text';
  if v_fn is null then raise exception 'Commercial sale RPC signature missing'; end if;
  v_lower_definition := lower(v_definition);
  if v_lower_definition not like '%security definer%' then raise exception 'Commercial sale RPC must be SECURITY DEFINER'; end if;
  if v_lower_definition not like '%set search_path%' or v_lower_definition not like '%pg_catalog%' or v_lower_definition not like '%public%' then raise exception 'Commercial sale RPC search_path is not controlled'; end if;
  if v_lower_definition not like '%set row_security%' or v_lower_definition not like '%off%' then raise exception 'Commercial sale RPC row_security is not controlled'; end if;
  if v_lower_definition not like '%for update%' then raise exception 'Commercial sale RPC must strongly lock offer and plan'; end if;
  if v_lower_definition not like '%v_offer.offer_type <> ''course''%' then raise exception 'COURSE-only protection missing'; end if;
  if v_lower_definition not like '%online catalog sales are not supported in this flow%' then raise exception 'ONLINE_CATALOG protection missing'; end if;
  if v_lower_definition not like '%offer_id = p_offer_id%' then raise exception 'Offer/plan relationship validation missing'; end if;
  if v_lower_definition not like '%quantity_min is not null%' or v_lower_definition not like '%quantity_max is not null%' then raise exception 'Quantity-plan protection missing'; end if;
  if v_lower_definition not like '%course_interest_id%' then raise exception 'Lead/course mismatch protection missing'; end if;
  if v_lower_definition not like '%v_plan.total_amount%' then raise exception 'Plan total derivation missing'; end if;
  if v_lower_definition not like '%when ''pix'' then ''pix''%' or v_lower_definition not like '%when ''cash'' then ''dinheiro''%' or v_lower_definition not like '%when ''credit_card'' then ''cartao_credito''%' then raise exception 'Payment mapping missing'; end if;
  if v_lower_definition not like '%payment_method_snapshot%' or v_lower_definition not like '%installment_count_snapshot%' or v_lower_definition not like '%total_amount_snapshot%' then raise exception 'Commercial snapshots missing'; end if;
  if v_lower_definition not like '%coalesce(v_plan.installment_count, 1)%' then raise exception 'Legacy installment derivation missing'; end if;
  if v_lower_definition not like '%offer_code%' or v_lower_definition not like '%price_plan_code%' then raise exception 'Commercial audit metadata missing'; end if;
  if v_lower_definition not like '%insert into public.students%' or v_lower_definition not like '%insert into public.sales%' then raise exception 'Student/sale atomic flow missing'; end if;
  if v_lower_definition not like '%status = ''won''%' or v_lower_definition not like '%status = ''canceled''%' then raise exception 'Lead/activity completion flow missing'; end if;
  if v_lower_definition not like '%write_audit_log%' or v_lower_definition not like '%return json_build_object%' then raise exception 'Audit/return flow missing'; end if;

  if has_function_privilege('anon', v_fn, 'EXECUTE')
     or has_function_privilege('public', v_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Commercial sale RPC grants are incorrect';
  end if;

  if has_function_privilege('authenticated', 'public.create_sale_from_lead(uuid,uuid,numeric,text,numeric,integer,text)', 'EXECUTE') then
    raise exception 'Legacy sale RPC must be disabled';
  end if;

  select count(*) into v_sales from public.sales;
  if v_sales <> 15 then raise exception 'Historical sales count changed'; end if;
  select count(*) into v_legacy_refs from public.sales where offer_id is not null or price_plan_id is not null;
  if v_legacy_refs <> 0 then raise exception 'Historical sales were backfilled'; end if;
  raise notice 'regular course sale integration smoke passed';
end;
$$;
