-- FASE 2.8A.6.4.3 — SALES READ MODEL NORMALIZATION
-- Read-model only. Sale creation, constraints, contracts, enrollments, finances
-- and catalog writes are untouched. No historical backfill is performed.
begin;

-- Internal normalization helpers. They are revoked from every API role and are
-- reached only through the SECURITY DEFINER read RPCs below.
create or replace function public._sale_read_integrity_check(
  p_item_count integer,
  p_items jsonb
)
returns boolean
language sql
immutable
as $$
  select p_item_count = jsonb_array_length(p_items);
$$;

revoke all on function public._sale_read_integrity_check(integer, jsonb) from public, anon, authenticated;

comment on function public._sale_read_integrity_check(integer, jsonb) is
  'INTERNAL_READ_MODEL: exposes item_count/items cardinality divergence instead of hiding it.';

create or replace function public._sale_read_model_core(
  p_sale_id uuid,
  p_legacy_course_name text,
  p_offer_type_snapshot text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_items jsonb;
  v_item_count integer;
  v_course_display_mode text;
  v_course_summary text;
begin
  select count(*)::integer
    into v_item_count
    from public.sale_items si
   where si.sale_id = p_sale_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
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
      )
      order by si.position, si.id
    ),
    '[]'::jsonb
  )
    into v_items
    from public.sale_items si
   where si.sale_id = p_sale_id;

  -- Item quantity never defines the commercial offer type. The type is read
  -- only from the Sale's own snapshot; a null snapshot means LEGACY.
  v_course_display_mode := case
    when v_item_count = 0 then 'LEGACY'
    when v_item_count = 1 then 'SINGLE'
    else 'MULTIPLE'
  end;

  v_course_summary := case
    when v_item_count = 0 then p_legacy_course_name
    when v_item_count = 1 then v_items->0->>'course_name_snapshot'
    else v_item_count::text || ' cursos'
  end;

  return jsonb_build_object(
    'items', v_items,
    'item_count', v_item_count,
    'item_count_matches_items', public._sale_read_integrity_check(v_item_count, v_items),
    'course_display_mode', v_course_display_mode,
    'course_summary', v_course_summary,
    'offer_type', p_offer_type_snapshot,
    'commercial_type', coalesce(p_offer_type_snapshot, 'LEGACY')
  );
end;
$$;

revoke all on function public._sale_read_model_core(uuid, text, text) from public, anon, authenticated;

comment on function public._sale_read_model_core(uuid, text, text) is
  'INTERNAL_READ_MODEL: canonical Sale presentation fields derived from Sale snapshots and Sale Items only.';

-- ---------------------------------------------------------------------------
-- get_sale_detail: append normalized fields. Signature, authorization,
-- ownership, enrollment link and every legacy field are preserved.
-- ---------------------------------------------------------------------------
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
  -- _get_sale_detail_base still enforces authentication, sales.view and
  -- ownership before any normalized payload is attached.
  v_result := public._get_sale_detail_base(p_sale_id)::jsonb;

  v_result := coalesce(
    v_result || (
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
          'course_workload_snapshot', s.course_workload_snapshot,
          'course_modality_snapshot', s.course_modality_snapshot
        )
        || public._sale_read_model_core(s.id, s.course_name_snapshot, s.offer_type_snapshot)
        from public.sales s
       where s.id = p_sale_id
    ),
    v_result
  );

  return coalesce((
    select v_result || jsonb_build_object(
      'enrollment_id', e.id,
      'enrollment_code', e.enrollment_code,
      'enrollment_status', e.status
    )
    from public.enrollments e
    where e.sale_id = p_sale_id
  ), v_result)::json;
end;
$$;

revoke execute on function public.get_sale_detail(uuid) from public, anon;
grant execute on function public.get_sale_detail(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- list_sales: one Sale per row. Derived fields come from a single-row lateral
-- helper; course filtering also recognizes sale_items.course_id without any
-- JOIN row multiplication. Signature, RBAC, ownership and paging are kept.
-- ---------------------------------------------------------------------------
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
    and (p_course_id is null
         or s.course_id = p_course_id
         or exists (
           select 1 from public.sale_items si
           where si.sale_id = s.id and si.course_id = p_course_id
         ))
    and (p_date_from is null or s.sale_date >= p_date_from)
    and (p_date_to is null or s.sale_date <= p_date_to)
    and (p_search is null or p_search = ''
         or s.sale_code ilike '%' || p_search || '%'
         or p.full_name ilike '%' || p_search || '%');

  select json_agg(row_to_json(t)) into v_data
  from (
    select
      s.id, s.sale_code, s.status, s.lead_id,
      l.lead_code,
      p.full_name,
      s.course_name_snapshot as course_name,
      s.course_workload_snapshot,
      s.course_modality_snapshot,
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
      rm.model->'items' as items,
      (rm.model->>'item_count')::integer as item_count,
      (rm.model->>'item_count_matches_items')::boolean as item_count_matches_items,
      rm.model->>'course_display_mode' as course_display_mode,
      rm.model->>'course_summary' as course_summary,
      rm.model->>'offer_type' as offer_type,
      rm.model->>'commercial_type' as commercial_type,
      s.created_at
    from public.sales s
    join public.people p on p.id = s.person_id
    join public.profiles pr on pr.id = s.seller_user_id
    left join public.crm_leads l on l.id = s.lead_id
    left join lateral (
      select public._sale_read_model_core(s.id, s.course_name_snapshot, s.offer_type_snapshot) as model
    ) rm on true
    where (v_has_view_all or s.seller_user_id = auth.uid())
      and (p_status is null or s.status = p_status)
      and (p_seller_user_id is null or s.seller_user_id = p_seller_user_id)
      and (p_course_id is null
           or s.course_id = p_course_id
           or exists (
             select 1 from public.sale_items si
             where si.sale_id = s.id and si.course_id = p_course_id
           ))
      and (p_date_from is null or s.sale_date >= p_date_from)
      and (p_date_to is null or s.sale_date <= p_date_to)
      and (p_search is null or p_search = ''
           or s.sale_code ilike '%' || p_search || '%'
           or p.full_name ilike '%' || p_search || '%')
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

-- list_sale_items already satisfies signature, ordering, snapshots, RLS and
-- permissions for all three scenarios and is intentionally unchanged.

commit;
