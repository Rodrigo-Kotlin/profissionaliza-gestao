-- FASE 2.8A.6.1 — SALES COMMERCIAL SNAPSHOT CORE
-- Schema-only preparation for offer/price-plan snapshots.
-- Historical sales remain nullable and are not backfilled.
begin;

alter table public.sales
  add column if not exists offer_id uuid,
  add column if not exists price_plan_id uuid,
  add column if not exists offer_code_snapshot text,
  add column if not exists offer_name_snapshot text,
  add column if not exists offer_type_snapshot text,
  add column if not exists price_plan_code_snapshot text,
  add column if not exists payment_method_snapshot text,
  add column if not exists pricing_model_snapshot text,
  add column if not exists installment_count_snapshot integer,
  add column if not exists installment_amount_snapshot numeric(12,2),
  add column if not exists quantity_min_snapshot integer,
  add column if not exists quantity_max_snapshot integer,
  add column if not exists cash_price_snapshot numeric(12,2),
  add column if not exists enrollment_fee_snapshot numeric(12,2),
  add column if not exists total_amount_snapshot numeric(12,2);

alter table public.sales
  add constraint sales_offer_id_fkey
    foreign key (offer_id) references public.course_offers(id) on delete restrict,
  add constraint sales_price_plan_id_fkey
    foreign key (price_plan_id) references public.price_plans(id) on delete restrict,
  add constraint sales_offer_price_plan_pair_check
    check ((offer_id is null and price_plan_id is null) or (offer_id is not null and price_plan_id is not null)),
  add constraint sales_installment_count_snapshot_check
    check (installment_count_snapshot is null or installment_count_snapshot >= 1),
  add constraint sales_installment_amount_snapshot_check
    check (installment_amount_snapshot is null or (installment_amount_snapshot <> 'NaN'::numeric and installment_amount_snapshot <> 'Infinity'::numeric and installment_amount_snapshot <> '-Infinity'::numeric and installment_amount_snapshot >= 0)),
  add constraint sales_cash_price_snapshot_check
    check (cash_price_snapshot is null or (cash_price_snapshot <> 'NaN'::numeric and cash_price_snapshot <> 'Infinity'::numeric and cash_price_snapshot <> '-Infinity'::numeric and cash_price_snapshot >= 0)),
  add constraint sales_enrollment_fee_snapshot_check
    check (enrollment_fee_snapshot is null or (enrollment_fee_snapshot <> 'NaN'::numeric and enrollment_fee_snapshot <> 'Infinity'::numeric and enrollment_fee_snapshot <> '-Infinity'::numeric and enrollment_fee_snapshot >= 0)),
  add constraint sales_total_amount_snapshot_check
    check (total_amount_snapshot is null or (total_amount_snapshot <> 'NaN'::numeric and total_amount_snapshot <> 'Infinity'::numeric and total_amount_snapshot <> '-Infinity'::numeric and total_amount_snapshot >= 0)),
  add constraint sales_quantity_min_snapshot_check
    check (quantity_min_snapshot is null or quantity_min_snapshot >= 1),
  add constraint sales_quantity_max_snapshot_check
    check (quantity_max_snapshot is null or quantity_max_snapshot >= 1),
  add constraint sales_quantity_snapshot_range_check
    check (
      quantity_min_snapshot is null
      or quantity_max_snapshot is null
      or quantity_max_snapshot >= quantity_min_snapshot
    );

create index if not exists sales_offer_id_idx
  on public.sales(offer_id)
  where offer_id is not null;

create index if not exists sales_price_plan_id_idx
  on public.sales(price_plan_id)
  where price_plan_id is not null;

-- Additive read payload for the existing sales list RPC.
create or replace function public.list_sales(
  p_search         text default null,
  p_status         text default null,
  p_seller_user_id uuid default null,
  p_course_id      uuid default null,
  p_date_from      date default null,
  p_date_to        date default null,
  p_page           integer default 1,
  p_page_size      integer default 25
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_total bigint;
  v_data json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_permission('sales.view') then
    raise exception 'Permission denied: sales.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('sales.view_all');
  v_page := greatest(coalesce(p_page, 1), 1);
  v_page_size := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset := (v_page - 1) * v_page_size;

  select count(*) into v_total
  from public.sales s
  join public.people p on p.id = s.person_id
  join public.profiles pr on pr.id = s.seller_user_id
  where (v_has_view_all or s.seller_user_id = auth.uid())
    and (p_status is null or s.status = p_status)
    and (p_seller_user_id is null or s.seller_user_id = p_seller_user_id)
    and (p_course_id is null or s.course_id = p_course_id)
    and (p_date_from is null or s.sale_date >= p_date_from)
    and (p_date_to is null or s.sale_date <= p_date_to)
    and (p_search is null or p_search = '' or s.sale_code ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%');

  select json_agg(row_to_json(t)) into v_data
  from (
    select
      s.id, s.sale_code, s.status, s.lead_id,
      l.lead_code,
      p.full_name,
      s.course_name_snapshot as course_name,
      pr.full_name as seller_name,
      s.sale_date, s.gross_value, s.discount_value, s.net_value,
      s.payment_method, s.installments,
      s.offer_id, s.price_plan_id,
      s.offer_code_snapshot, s.offer_name_snapshot, s.offer_type_snapshot,
      s.price_plan_code_snapshot, s.payment_method_snapshot,
      s.pricing_model_snapshot, s.installment_count_snapshot,
      s.installment_amount_snapshot, s.quantity_min_snapshot,
      s.quantity_max_snapshot, s.cash_price_snapshot,
      s.enrollment_fee_snapshot, s.total_amount_snapshot,
      s.created_at
    from public.sales s
    join public.people p on p.id = s.person_id
    join public.profiles pr on pr.id = s.seller_user_id
    left join public.crm_leads l on l.id = s.lead_id
    where (v_has_view_all or s.seller_user_id = auth.uid())
      and (p_status is null or s.status = p_status)
      and (p_seller_user_id is null or s.seller_user_id = p_seller_user_id)
      and (p_course_id is null or s.course_id = p_course_id)
      and (p_date_from is null or s.sale_date >= p_date_from)
      and (p_date_to is null or s.sale_date <= p_date_to)
      and (p_search is null or p_search = '' or s.sale_code ilike '%' || p_search || '%' or p.full_name ilike '%' || p_search || '%')
    order by s.created_at desc
    limit v_page_size offset v_offset
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

-- Preserve the existing enrollment-enriched detail wrapper and add the
-- commercial snapshot payload. The base detail RPC remains unchanged.
create or replace function public.get_sale_detail(p_sale_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_result jsonb;
begin
  v_result := public._get_sale_detail_base(p_sale_id)::jsonb;
  v_result := v_result || (
    select jsonb_build_object(
      'offer_id', s.offer_id,
      'price_plan_id', s.price_plan_id,
      'offer_code_snapshot', s.offer_code_snapshot,
      'offer_name_snapshot', s.offer_name_snapshot,
      'offer_type_snapshot', s.offer_type_snapshot,
      'price_plan_code_snapshot', s.price_plan_code_snapshot,
      'payment_method_snapshot', s.payment_method_snapshot,
      'pricing_model_snapshot', s.pricing_model_snapshot,
      'installment_count_snapshot', s.installment_count_snapshot,
      'installment_amount_snapshot', s.installment_amount_snapshot,
      'quantity_min_snapshot', s.quantity_min_snapshot,
      'quantity_max_snapshot', s.quantity_max_snapshot,
      'cash_price_snapshot', s.cash_price_snapshot,
      'enrollment_fee_snapshot', s.enrollment_fee_snapshot,
      'total_amount_snapshot', s.total_amount_snapshot
    )
    from public.sales s
    where s.id = p_sale_id
  );
  return coalesce((
    select v_result || jsonb_build_object(
      'enrollment_id', e.id,
      'enrollment_code', e.enrollment_code,
      'enrollment_status', e.status
    )
    from public.enrollments e
    where e.sale_id = p_sale_id
  ), v_result);
end;
$$;

revoke execute on function public.list_sales(text,text,uuid,uuid,date,date,integer,integer) from public, anon;
grant execute on function public.list_sales(text,text,uuid,uuid,date,date,integer,integer) to authenticated;
revoke execute on function public.get_sale_detail(uuid) from public, anon;
grant execute on function public.get_sale_detail(uuid) to authenticated;

commit;
