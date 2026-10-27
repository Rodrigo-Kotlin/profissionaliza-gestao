-- FASE 2.8A.6.4.1 — SALE_ITEMS CORE + READ SUPPORT
-- Schema/read-only preparation only. Existing and new Sale creation flows do
-- not write sale_items in this phase.
begin;

create table if not exists public.sale_items (
  id                       uuid primary key default gen_random_uuid(),
  sale_id                  uuid not null references public.sales(id) on delete restrict,
  position                 integer not null,
  course_id                uuid not null references public.courses(id) on delete restrict,
  offer_item_id            uuid references public.offer_items(id) on delete restrict,
  course_code_snapshot     text,
  course_name_snapshot     text not null,
  course_workload_snapshot integer,
  course_modality_snapshot text,
  created_at               timestamptz not null default now(),
  created_by               uuid references auth.users(id) on delete set null,
  constraint sale_items_position_check check (position >= 1),
  constraint sale_items_course_workload_snapshot_check check (
    course_workload_snapshot is null or course_workload_snapshot > 0
  ),
  constraint sale_items_course_modality_snapshot_check check (
    course_modality_snapshot is null
    or course_modality_snapshot in ('PRESENCIAL','ONLINE','HIBRIDO')
  ),
  constraint sale_items_sale_position_key unique (sale_id, position),
  constraint sale_items_sale_course_key unique (sale_id, course_id)
);

comment on table public.sale_items is
  'Immutable course snapshots associated with a sale. Created only by trusted Sale creation RPCs. Relationship validation is performed by the Sale RPC: RELATIONSHIP_VALIDATED_BY_SALE_RPC.';

comment on column public.sale_items.offer_item_id is
  'Optional catalog provenance. Same-offer/course validation is deferred to the Sale RPC: RELATIONSHIP_VALIDATED_BY_SALE_RPC.';

-- The online catalog prices the complete Sale, not individual courses.
-- ITEM_PRICE_ALLOCATION_NOT_DEFINED
-- ITEM_DISCOUNT_ALLOCATION_NOT_DEFINED

create index if not exists sale_items_course_id_idx
  on public.sale_items(course_id);

create index if not exists sale_items_offer_item_id_idx
  on public.sale_items(offer_item_id)
  where offer_item_id is not null;

alter table public.sale_items enable row level security;
revoke all on table public.sale_items from public, anon, authenticated;

-- Read-only item access follows the existing Sale ownership/RBAC boundary.
create or replace function public.list_sale_items(p_sale_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_data json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('sales.view') then
    raise exception 'Permission denied: sales.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('sales.view_all');

  if not exists (select 1 from public.sales where id = p_sale_id) then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if not v_has_view_all and not exists (
    select 1 from public.sales where id = p_sale_id and seller_user_id = auth.uid()
  ) then
    raise exception 'Not authorized to view this sale' using errcode = '42501';
  end if;

  select json_agg(row_to_json(t) order by t.position)
    into v_data
  from (
    select
      id,
      sale_id,
      position,
      course_id,
      offer_item_id,
      course_code_snapshot,
      course_name_snapshot,
      course_workload_snapshot,
      course_modality_snapshot,
      created_at
    from public.sale_items
    where sale_id = p_sale_id
    order by position
  ) t;

  return coalesce(v_data, '[]'::json);
end;
$$;

revoke execute on function public.list_sale_items(uuid) from public, anon;
grant execute on function public.list_sale_items(uuid) to authenticated;

-- Add item_count without changing existing list fields or filters.
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
      (select count(*)::integer from public.sale_items si where si.sale_id = s.id) as item_count,
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

revoke execute on function public.list_sales(text,text,uuid,uuid,date,date,integer,integer) from public, anon;
grant execute on function public.list_sales(text,text,uuid,uuid,date,date,integer,integer) to authenticated;

-- Add items and item_count to the existing detail payload. Existing fields and
-- historical data remain unchanged; historical Sales return items = [].
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
      'total_amount_snapshot', s.total_amount_snapshot,
      'item_count', (select count(*)::integer from public.sale_items si where si.sale_id = s.id),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', si.id,
          'sale_id', si.sale_id,
          'position', si.position,
          'course_id', si.course_id,
          'offer_item_id', si.offer_item_id,
          'course_code_snapshot', si.course_code_snapshot,
          'course_name_snapshot', si.course_name_snapshot,
          'course_workload_snapshot', si.course_workload_snapshot,
          'course_modality_snapshot', si.course_modality_snapshot,
          'created_at', si.created_at
        ) order by si.position)
        from public.sale_items si where si.sale_id = s.id
      ), '[]'::jsonb)
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

revoke execute on function public.get_sale_detail(uuid) from public, anon;
grant execute on function public.get_sale_detail(uuid) to authenticated;

commit;
