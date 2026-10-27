-- FASE 2.8A.6.3 — CONTRACT SNAPSHOT COMPATIBILITY
-- Local implementation only. This migration is intentionally not applied remotely yet.
begin;

-- ---------------------------------------------------------------------------
-- 1. Sale academic snapshots
-- ---------------------------------------------------------------------------
alter table public.sales
  add column if not exists course_workload_snapshot integer,
  add column if not exists course_modality_snapshot text;

alter table public.sales
  add constraint sales_course_workload_snapshot_check
    check (course_workload_snapshot is null or course_workload_snapshot > 0),
  add constraint sales_course_modality_snapshot_check
    check (course_modality_snapshot is null or course_modality_snapshot in ('PRESENCIAL','ONLINE','HIBRIDO'));

-- ---------------------------------------------------------------------------
-- 2. Contract commercial snapshots
-- ---------------------------------------------------------------------------
alter table public.contracts
  add column if not exists offer_code_snapshot text,
  add column if not exists offer_name_snapshot text,
  add column if not exists offer_type_snapshot text,
  add column if not exists price_plan_code_snapshot text,
  add column if not exists commercial_payment_method_snapshot text,
  add column if not exists pricing_model_snapshot text,
  add column if not exists installment_count_commercial_snapshot integer,
  add column if not exists installment_amount_snapshot numeric(12,2),
  add column if not exists cash_price_snapshot numeric(12,2),
  add column if not exists enrollment_fee_snapshot numeric(12,2),
  add column if not exists total_amount_snapshot numeric(12,2);

alter table public.contracts
  add constraint contracts_commercial_payment_method_check
    check (commercial_payment_method_snapshot is null or commercial_payment_method_snapshot in ('PIX','CASH','DEBIT','BOLETO','CREDIT_CARD','OTHER')),
  add constraint contracts_installment_count_commercial_check
    check (installment_count_commercial_snapshot is null or installment_count_commercial_snapshot >= 1),
  add constraint contracts_installment_amount_snapshot_check
    check (installment_amount_snapshot is null or (installment_amount_snapshot >= 0 and installment_amount_snapshot <> 'NaN'::numeric and installment_amount_snapshot <> 'Infinity'::numeric and installment_amount_snapshot <> '-Infinity'::numeric)),
  add constraint contracts_cash_price_snapshot_check
    check (cash_price_snapshot is null or (cash_price_snapshot >= 0 and cash_price_snapshot <> 'NaN'::numeric and cash_price_snapshot <> 'Infinity'::numeric and cash_price_snapshot <> '-Infinity'::numeric)),
  add constraint contracts_enrollment_fee_snapshot_check
    check (enrollment_fee_snapshot is null or (enrollment_fee_snapshot >= 0 and enrollment_fee_snapshot <> 'NaN'::numeric and enrollment_fee_snapshot <> 'Infinity'::numeric and enrollment_fee_snapshot <> '-Infinity'::numeric)),
  add constraint contracts_total_amount_snapshot_check
    check (total_amount_snapshot is null or (total_amount_snapshot >= 0 and total_amount_snapshot <> 'NaN'::numeric and total_amount_snapshot <> 'Infinity'::numeric and total_amount_snapshot <> '-Infinity'::numeric));

-- ---------------------------------------------------------------------------
-- 3. Commercial sale RPC — freeze course workload/modality in Sale
-- ---------------------------------------------------------------------------
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

  select l.*, ps.code as stage_code into v_lead
  from public.crm_leads l
  join public.crm_pipeline_stages ps on ps.id = l.stage_id
  where l.id = p_lead_id for update;
  if v_lead is null then raise exception 'Lead not found' using errcode = 'P0002'; end if;
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.view_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;
  if v_lead.status <> 'OPEN' then raise exception 'Lead is not open' using errcode = '22023'; end if;
  if v_lead.stage_code not in ('PROPOSAL_SENT', 'NEGOTIATION') then
    raise exception 'Lead stage must be PROPOSAL_SENT or NEGOTIATION' using errcode = '22023';
  end if;

  select * into v_offer from public.course_offers where id = p_offer_id for update;
  if v_offer is null then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if v_offer.offer_type <> 'COURSE' then
    raise exception 'Online catalog sales are not supported in this flow' using errcode = '22023';
  end if;
  if v_offer.status <> 'ACTIVE' or v_offer.valid_from > now()
     or (v_offer.valid_until is not null and v_offer.valid_until <= now()) then
    raise exception 'Offer is not currently active' using errcode = '22023';
  end if;
  if v_offer.course_id is null then raise exception 'Course offer has no course' using errcode = '22023'; end if;

  select * into v_plan from public.price_plans
  where id = p_price_plan_id and offer_id = p_offer_id for update;
  if v_plan is null then raise exception 'Price plan does not belong to offer' using errcode = '22023'; end if;
  if v_plan.status <> 'ACTIVE' or v_plan.valid_from > now()
     or (v_plan.valid_until is not null and v_plan.valid_until <= now()) then
    raise exception 'Price plan is not currently active' using errcode = '22023';
  end if;

  select * into v_course from public.courses where id = v_offer.course_id for share;
  if v_course is null then raise exception 'Course not found' using errcode = 'P0002'; end if;
  if v_course.status <> 'ACTIVE' then raise exception 'Course is not active' using errcode = '22023'; end if;
  if v_lead.course_interest_id is not null and v_lead.course_interest_id <> v_offer.course_id then
    raise exception 'Offer course does not match lead course interest' using errcode = '22023';
  end if;
  if v_plan.quantity_min is not null or v_plan.quantity_max is not null then
    raise exception 'Quantity-based price plans are not supported for regular COURSE sales' using errcode = '22023';
  end if;
  if v_discount is null or v_discount < 0 or v_discount = 'NaN'::numeric
     or v_discount = 'Infinity'::numeric or v_discount = '-Infinity'::numeric then
    raise exception 'Discount value must be finite and non-negative' using errcode = '22023';
  end if;
  if v_discount > v_plan.total_amount then raise exception 'Discount cannot exceed plan total amount' using errcode = '22023'; end if;

  v_payment_method := case v_plan.payment_method
    when 'PIX' then 'PIX' when 'CASH' then 'DINHEIRO' when 'DEBIT' then 'CARTAO_DEBITO'
    when 'BOLETO' then 'BOLETO' when 'CREDIT_CARD' then 'CARTAO_CREDITO' when 'OTHER' then 'OUTRO'
    else null end;
  if v_payment_method is null then raise exception 'Price plan payment method cannot be mapped to sale' using errcode = '22023'; end if;
  v_installments := coalesce(v_plan.installment_count, 1);

  insert into public.students (person_id, student_code, status, registration_date, created_by, updated_by)
  values (v_lead.person_id, 'ALU-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.student_code_seq')::text, 6, '0'), 'PRE_CADASTRO', current_date, auth.uid(), auth.uid())
  on conflict (person_id) do nothing returning id into v_student_id;
  if v_student_id is null then
    select id into v_student_id from public.students where person_id = v_lead.person_id;
  else
    insert into public.student_status_history (student_id, previous_status, new_status, reason, changed_by)
    values (v_student_id, null, 'PRE_CADASTRO', 'Criação automática via venda', auth.uid());
  end if;

  v_sale_code := 'VND-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.sale_code_seq')::text, 6, '0');
  insert into public.sales (
    sale_code, lead_id, person_id, student_id, course_id, course_name_snapshot, course_price_snapshot,
    course_workload_snapshot, course_modality_snapshot, seller_user_id, sale_date, gross_value, discount_value,
    payment_method, installments, commercial_notes, offer_id, price_plan_id, offer_code_snapshot,
    offer_name_snapshot, offer_type_snapshot, price_plan_code_snapshot, payment_method_snapshot,
    pricing_model_snapshot, installment_count_snapshot, installment_amount_snapshot, quantity_min_snapshot,
    quantity_max_snapshot, cash_price_snapshot, enrollment_fee_snapshot, total_amount_snapshot, created_by, updated_by
  ) values (
    v_sale_code, p_lead_id, v_lead.person_id, v_student_id, v_offer.course_id, v_course.name, v_plan.total_amount,
    v_course.workload_hours, v_course.modality, v_lead.owner_user_id, current_date, v_plan.total_amount, v_discount,
    v_payment_method, v_installments, nullif(trim(coalesce(p_commercial_notes, '')), ''), v_offer.id, v_plan.id,
    v_offer.code, v_offer.name, v_offer.offer_type, v_plan.code, v_plan.payment_method, v_plan.pricing_model,
    v_plan.installment_count, v_plan.installment_amount, v_plan.quantity_min, v_plan.quantity_max,
    v_plan.cash_price, v_plan.enrollment_fee, v_plan.total_amount, auth.uid(), auth.uid()
  ) returning id into v_sale_id;

  update public.crm_leads set status = 'WON', closed_at = now(), updated_by = auth.uid() where id = p_lead_id;
  update public.crm_activities set status = 'CANCELED', updated_by = auth.uid() where lead_id = p_lead_id and status = 'PENDING';
  get diagnostics v_cancelled = row_count;

  perform public.write_audit_log('sales.created', 'sale', v_sale_id::text, jsonb_build_object(
    'sale_code', v_sale_code, 'lead_id', p_lead_id::text, 'lead_code', v_lead.lead_code,
    'student_id', v_student_id::text, 'course_id', v_offer.course_id::text, 'gross_value', v_plan.total_amount,
    'discount_value', v_discount, 'net_value', v_plan.total_amount - v_discount, 'payment_method', v_payment_method,
    'installments', v_installments, 'offer_id', v_offer.id::text, 'offer_code', v_offer.code,
    'price_plan_id', v_plan.id::text, 'price_plan_code', v_plan.code, 'cancelled_activities', v_cancelled
  ));
  perform public.write_audit_log('crm.lead_won', 'crm_lead', p_lead_id::text, jsonb_build_object(
    'sale_id', v_sale_id::text, 'sale_code', v_sale_code, 'lead_code', v_lead.lead_code,
    'offer_id', v_offer.id::text, 'price_plan_id', v_plan.id::text
  ));
  return json_build_object('sale_id', v_sale_id, 'sale_code', v_sale_code);
end;
$$;

revoke execute on function public.create_sale_from_commercial_offer(uuid,uuid,uuid,numeric,text) from public, anon;
grant execute on function public.create_sale_from_commercial_offer(uuid,uuid,uuid,numeric,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Contract creation — commercial snapshots with historical fallback
-- ---------------------------------------------------------------------------
create or replace function public.create_contract_from_sale(
  p_sale_id uuid,
  p_contractor_person_id uuid,
  p_contract_notes text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sale record;
  v_student record;
  v_student_person record;
  v_contractor record;
  v_course record;
  v_contract_id uuid;
  v_contract_code text;
  v_commercial boolean;
  v_workload integer;
  v_modality text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('contracts.create') then raise exception 'Permission denied: contracts.create' using errcode = '42501'; end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if v_sale is null then raise exception 'Sale not found' using errcode = 'P0002'; end if;
  if v_sale.status <> 'CONFIRMED' then raise exception 'Only confirmed sales can generate a contract' using errcode = '22023'; end if;
  if v_sale.seller_user_id <> auth.uid() and not public.has_permission('contracts.view_all') then
    raise exception 'Permission denied: not sale seller' using errcode = '42501';
  end if;
  if exists (select 1 from public.contracts where sale_id = p_sale_id) then
    raise exception 'Contract already exists for this sale' using errcode = '22023';
  end if;

  v_commercial := v_sale.offer_id is not null;
  if v_commercial then
    if v_sale.course_id is null or v_sale.offer_id is null or v_sale.price_plan_id is null
       or v_sale.course_name_snapshot is null
       or v_sale.course_workload_snapshot is null or v_sale.course_modality_snapshot is null
       or v_sale.offer_code_snapshot is null or v_sale.offer_name_snapshot is null
       or v_sale.offer_type_snapshot is null or v_sale.price_plan_code_snapshot is null
       or v_sale.payment_method_snapshot is null or v_sale.pricing_model_snapshot is null
       or v_sale.total_amount_snapshot is null or v_sale.gross_value is null
       or v_sale.discount_value is null or v_sale.net_value is null then
      raise exception 'Commercial sale snapshots are incomplete' using errcode = '22023';
    end if;
    if v_sale.payment_method_snapshot <> 'CASH'
       and v_sale.pricing_model_snapshot <> 'CASH'
       and v_sale.installment_count_snapshot is null then
      raise exception 'Commercial installment count snapshot is required' using errcode = '22023';
    end if;
    v_workload := v_sale.course_workload_snapshot;
    v_modality := v_sale.course_modality_snapshot;
  else
    select * into v_course from public.courses where id = v_sale.course_id;
    if v_course is null then raise exception 'Course not found' using errcode = 'P0002'; end if;
    v_workload := v_course.workload_hours;
    v_modality := v_course.modality;
  end if;

  select * into v_student from public.students where id = v_sale.student_id;
  if v_student is null then raise exception 'Student not found' using errcode = 'P0002'; end if;
  select * into v_student_person from public.people where id = v_student.person_id;
  if v_student_person is null then raise exception 'Student person not found' using errcode = 'P0002'; end if;
  select * into v_contractor from public.people where id = p_contractor_person_id;
  if v_contractor is null then raise exception 'Contractor not found' using errcode = 'P0002'; end if;

  v_contract_code := 'CTR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.contract_code_seq')::text, 6, '0');
  insert into public.contracts (
    contract_code, sale_id, student_id, contractor_person_id, status, student_name_snapshot,
    contractor_name_snapshot, contractor_cpf_snapshot, contractor_address_snapshot,
    contractor_phone_snapshot, contractor_email_snapshot, course_name_snapshot,
    course_workload_snapshot, course_modality_snapshot, gross_value_snapshot,
    discount_value_snapshot, net_value_snapshot, payment_method_snapshot,
    installments_snapshot, commercial_notes_snapshot, offer_code_snapshot, offer_name_snapshot,
    offer_type_snapshot, price_plan_code_snapshot, commercial_payment_method_snapshot,
    pricing_model_snapshot, installment_count_commercial_snapshot, installment_amount_snapshot,
    cash_price_snapshot, enrollment_fee_snapshot, total_amount_snapshot, contract_notes,
    created_by, updated_by
  ) values (
    v_contract_code, p_sale_id, v_sale.student_id, p_contractor_person_id, 'DRAFT',
    v_student_person.full_name, v_contractor.full_name, v_contractor.cpf,
    case when v_contractor.street is null and v_contractor.postal_code is null and v_contractor.city is null then null
      else jsonb_build_object('postal_code', v_contractor.postal_code, 'street', v_contractor.street,
        'number', v_contractor.number, 'complement', v_contractor.complement, 'district', v_contractor.district,
        'city', v_contractor.city, 'state', v_contractor.state, 'country', v_contractor.country) end,
    v_contractor.phone, v_contractor.email, v_sale.course_name_snapshot, v_workload, v_modality,
    v_sale.gross_value, v_sale.discount_value, v_sale.net_value, v_sale.payment_method, v_sale.installments,
    v_sale.commercial_notes, case when v_commercial then v_sale.offer_code_snapshot end,
    case when v_commercial then v_sale.offer_name_snapshot end, case when v_commercial then v_sale.offer_type_snapshot end,
    case when v_commercial then v_sale.price_plan_code_snapshot end, case when v_commercial then v_sale.payment_method_snapshot end,
    case when v_commercial then v_sale.pricing_model_snapshot end, case when v_commercial then v_sale.installment_count_snapshot end,
    case when v_commercial then v_sale.installment_amount_snapshot end, case when v_commercial then v_sale.cash_price_snapshot end,
    case when v_commercial then v_sale.enrollment_fee_snapshot end, case when v_commercial then v_sale.total_amount_snapshot end,
    nullif(trim(coalesce(p_contract_notes, '')), ''), auth.uid(), auth.uid()
  ) returning id into v_contract_id;

  perform public.write_audit_log('contracts.created', 'contract', v_contract_id::text, jsonb_build_object(
    'contract_code', v_contract_code, 'sale_id', p_sale_id::text, 'sale_code', v_sale.sale_code,
    'student_id', v_sale.student_id::text, 'contractor_person_id', p_contractor_person_id::text,
    'course_id', v_sale.course_id::text, 'net_value_snapshot', v_sale.net_value, 'status', 'DRAFT'
  ));
  return json_build_object('contract_id', v_contract_id, 'contract_code', v_contract_code, 'status', 'DRAFT');
end;
$$;

revoke execute on function public.create_contract_from_sale(uuid,uuid,text) from public, anon;
grant execute on function public.create_contract_from_sale(uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Additive contract detail payload
-- ---------------------------------------------------------------------------
create or replace function public.get_contract_detail(p_contract_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_result jsonb;
begin
  v_result := public._get_contract_detail_base(p_contract_id)::jsonb;
  v_result := v_result || (
    select jsonb_build_object(
      'offer_code_snapshot', c.offer_code_snapshot,
      'offer_name_snapshot', c.offer_name_snapshot,
      'offer_type_snapshot', c.offer_type_snapshot,
      'price_plan_code_snapshot', c.price_plan_code_snapshot,
      'commercial_payment_method_snapshot', c.commercial_payment_method_snapshot,
      'pricing_model_snapshot', c.pricing_model_snapshot,
      'installment_count_commercial_snapshot', c.installment_count_commercial_snapshot,
      'installment_amount_snapshot', c.installment_amount_snapshot,
      'cash_price_snapshot', c.cash_price_snapshot,
      'enrollment_fee_snapshot', c.enrollment_fee_snapshot,
      'total_amount_snapshot', c.total_amount_snapshot
    )
    from public.contracts c
    where c.id = p_contract_id
  );
  return coalesce((select v_result || jsonb_build_object(
    'enrollment_id', e.id,
    'enrollment_code', e.enrollment_code,
    'enrollment_status', e.status
  ) from public.enrollments e where e.contract_id = p_contract_id), v_result);
end;
$$;

revoke execute on function public.get_contract_detail(uuid) from public, anon;
grant execute on function public.get_contract_detail(uuid) to authenticated;

commit;
