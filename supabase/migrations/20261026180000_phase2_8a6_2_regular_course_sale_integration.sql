-- FASE 2.8A.6.2 — REGULAR COURSE SALE INTEGRATION
-- Adds a separate commercial sale RPC. The legacy RPC remains available.
-- LEGACY_RPC_DEPRECATION_PENDING; DISCOUNT_POLICY_PENDING.
begin;

create or replace function public.create_sale_from_commercial_offer(
  p_lead_id uuid,
  p_offer_id uuid,
  p_price_plan_id uuid,
  p_discount_value numeric default 0,
  p_commercial_notes text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead record;
  v_offer record;
  v_plan record;
  v_course record;
  v_student_id uuid;
  v_student_code text;
  v_sale_id uuid;
  v_sale_code text;
  v_cancelled integer;
  v_discount numeric(12,2) := p_discount_value;
  v_payment_method text;
  v_installments integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('sales.create') then
    raise exception 'Permission denied: sales.create' using errcode = '42501';
  end if;

  if p_lead_id is null or p_offer_id is null or p_price_plan_id is null then
    raise exception 'Lead, offer and price plan are required' using errcode = '22023';
  end if;

  select l.*, ps.code as stage_code
  into v_lead
  from public.crm_leads l
  join public.crm_pipeline_stages ps on ps.id = l.stage_id
  where l.id = p_lead_id
  for update;

  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.view_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;
  if v_lead.status <> 'OPEN' then
    raise exception 'Lead is not open' using errcode = '22023';
  end if;
  if v_lead.stage_code not in ('PROPOSAL_SENT', 'NEGOTIATION') then
    raise exception 'Lead stage must be PROPOSAL_SENT or NEGOTIATION' using errcode = '22023';
  end if;

  -- Strong row locks serialize this sale with activation/deactivation/update RPCs.
  select * into v_offer
  from public.course_offers
  where id = p_offer_id
  for update;
  if v_offer is null then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if v_offer.offer_type <> 'COURSE' then
    raise exception 'Online catalog sales are not supported in this flow' using errcode = '22023';
  end if;
  if v_offer.status <> 'ACTIVE'
     or v_offer.valid_from > now()
     or (v_offer.valid_until is not null and v_offer.valid_until <= now()) then
    raise exception 'Offer is not currently active' using errcode = '22023';
  end if;
  if v_offer.course_id is null then
    raise exception 'Course offer has no course' using errcode = '22023';
  end if;

  select * into v_plan
  from public.price_plans
  where id = p_price_plan_id
    and offer_id = p_offer_id
  for update;
  if v_plan is null then
    raise exception 'Price plan does not belong to offer' using errcode = '22023';
  end if;
  if v_plan.status <> 'ACTIVE'
     or v_plan.valid_from > now()
     or (v_plan.valid_until is not null and v_plan.valid_until <= now()) then
    raise exception 'Price plan is not currently active' using errcode = '22023';
  end if;

  select * into v_course from public.courses where id = v_offer.course_id for share;
  if v_course is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if v_course.status <> 'ACTIVE' then
    raise exception 'Course is not active' using errcode = '22023';
  end if;
  if v_lead.course_interest_id is not null and v_lead.course_interest_id <> v_offer.course_id then
    raise exception 'Offer course does not match lead course interest' using errcode = '22023';
  end if;
  if v_plan.quantity_min is not null or v_plan.quantity_max is not null then
    raise exception 'Quantity-based price plans are not supported for regular COURSE sales' using errcode = '22023';
  end if;

  if v_discount is null
     or v_discount < 0
     or v_discount = 'NaN'::numeric
     or v_discount = 'Infinity'::numeric
     or v_discount = '-Infinity'::numeric then
    raise exception 'Discount value must be finite and non-negative' using errcode = '22023';
  end if;
  if v_discount > v_plan.total_amount then
    raise exception 'Discount cannot exceed plan total amount' using errcode = '22023';
  end if;

  v_payment_method := case v_plan.payment_method
    when 'PIX' then 'PIX'
    when 'CASH' then 'DINHEIRO'
    when 'DEBIT' then 'CARTAO_DEBITO'
    when 'BOLETO' then 'BOLETO'
    when 'CREDIT_CARD' then 'CARTAO_CREDITO'
    when 'OTHER' then 'OUTRO'
    else null
  end;
  if v_payment_method is null then
    raise exception 'Price plan payment method cannot be mapped to sale' using errcode = '22023';
  end if;
  v_installments := coalesce(v_plan.installment_count, 1);

  v_student_code := 'ALU-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.student_code_seq')::text, 6, '0');
  insert into public.students (
    person_id, student_code, status, registration_date, created_by, updated_by
  ) values (
    v_lead.person_id, v_student_code, 'PRE_CADASTRO', current_date, auth.uid(), auth.uid()
  ) on conflict (person_id) do nothing returning id into v_student_id;

  if v_student_id is null then
    select id into v_student_id from public.students where person_id = v_lead.person_id;
  else
    insert into public.student_status_history (student_id, previous_status, new_status, reason, changed_by)
    values (v_student_id, null, 'PRE_CADASTRO', 'Criação automática via venda', auth.uid());
  end if;

  v_sale_code := 'VND-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.sale_code_seq')::text, 6, '0');
  insert into public.sales (
    sale_code, lead_id, person_id, student_id, course_id,
    course_name_snapshot, course_price_snapshot,
    seller_user_id, sale_date, gross_value, discount_value,
    payment_method, installments, commercial_notes,
    offer_id, price_plan_id,
    offer_code_snapshot, offer_name_snapshot, offer_type_snapshot,
    price_plan_code_snapshot, payment_method_snapshot, pricing_model_snapshot,
    installment_count_snapshot, installment_amount_snapshot,
    quantity_min_snapshot, quantity_max_snapshot,
    cash_price_snapshot, enrollment_fee_snapshot, total_amount_snapshot,
    created_by, updated_by
  ) values (
    v_sale_code, p_lead_id, v_lead.person_id, v_student_id, v_offer.course_id,
    v_course.name, v_plan.total_amount, -- legacy compatibility snapshot only
    v_lead.owner_user_id, current_date, v_plan.total_amount, v_discount,
    v_payment_method, v_installments, nullif(trim(coalesce(p_commercial_notes, '')), ''),
    v_offer.id, v_plan.id,
    v_offer.code, v_offer.name, v_offer.offer_type,
    v_plan.code, v_plan.payment_method, v_plan.pricing_model,
    v_plan.installment_count, v_plan.installment_amount,
    v_plan.quantity_min, v_plan.quantity_max,
    v_plan.cash_price, v_plan.enrollment_fee, v_plan.total_amount,
    auth.uid(), auth.uid()
  ) returning id into v_sale_id;

  update public.crm_leads set
    status = 'WON', closed_at = now(), updated_by = auth.uid()
  where id = p_lead_id;

  update public.crm_activities set
    status = 'CANCELED', updated_by = auth.uid()
  where lead_id = p_lead_id and status = 'PENDING';
  get diagnostics v_cancelled = row_count;

  perform public.write_audit_log(
    'sales.created', 'sale', v_sale_id::text,
    jsonb_build_object(
      'sale_code', v_sale_code,
      'lead_id', p_lead_id::text,
      'lead_code', v_lead.lead_code,
      'student_id', v_student_id::text,
      'course_id', v_offer.course_id::text,
      'gross_value', v_plan.total_amount,
      'discount_value', v_discount,
      'net_value', (v_plan.total_amount - v_discount),
      'payment_method', v_payment_method,
      'installments', v_installments,
      'offer_id', v_offer.id::text,
      'offer_code', v_offer.code,
      'price_plan_id', v_plan.id::text,
      'price_plan_code', v_plan.code,
      'cancelled_activities', v_cancelled
    )
  );

  perform public.write_audit_log(
    'crm.lead_won', 'crm_lead', p_lead_id::text,
    jsonb_build_object(
      'sale_id', v_sale_id::text,
      'sale_code', v_sale_code,
      'lead_code', v_lead.lead_code,
      'offer_id', v_offer.id::text,
      'price_plan_id', v_plan.id::text
    )
  );

  return json_build_object('sale_id', v_sale_id, 'sale_code', v_sale_code);
end;
$$;

revoke execute on function public.create_sale_from_commercial_offer(uuid,uuid,uuid,numeric,text) from public, anon;
grant execute on function public.create_sale_from_commercial_offer(uuid,uuid,uuid,numeric,text) to authenticated;

-- The legacy RPC remains defined for rollback/reference, but cannot create new sales.
-- LEGACY_RPC_DISABLED: all new regular sales must use the commercial RPC above.
revoke all on function public.create_sale_from_lead(uuid,uuid,numeric,text,numeric,integer,text) from public, anon, authenticated;

commit;
