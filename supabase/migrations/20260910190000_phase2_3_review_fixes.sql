-- FASE 2.3: REVIEW FIXES
-- Blocker 1: ADMIN sales.view_all + sales.cancel
-- Blocker 2: get_crm_lead_detail remove CONFIRMED filter
-- list_sales: page_size cap + snapshot
-- cancel_sale: 2000 char limit
-- get_sale_timeline: new RPC
begin;

-- =========================================================================
-- 1. BLOCKER 1 — ADMIN missing sales.view_all + sales.cancel
-- =========================================================================
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('sales.view_all', 'sales.cancel')
where r.code = 'ADMIN'
on conflict do nothing;

-- =========================================================================
-- 2. BLOCKER 2 — get_crm_lead_detail: remove CONFIRMED filter
--    sales.lead_id is UNIQUE, so LEFT JOIN without status filter
--    returns the sale regardless of CONFIRMED/CANCELED
-- =========================================================================
create or replace function public.get_crm_lead_detail(
  p_lead_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_user_id uuid;
  v_exists boolean;
  v_has_view_all boolean;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');

  select exists(select 1 from public.crm_leads where id = p_lead_id) into v_exists;
  if not v_exists then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  select owner_user_id into v_owner_user_id from public.crm_leads where id = p_lead_id;
  if v_owner_user_id is distinct from auth.uid() and not v_has_view_all then
    raise exception 'Not authorized to view this lead' using errcode = '42501';
  end if;

  select json_build_object(
    'id', l.id,
    'lead_code', l.lead_code,
    'person_id', l.person_id,
    'full_name', p.full_name,
    'phone', p.phone,
    'whatsapp', p.whatsapp,
    'email', p.email,
    'stage_id', l.stage_id,
    'stage_code', ps.code,
    'stage_name', ps.name,
    'source_id', l.source_id,
    'source_name', cs.name,
    'course_interest_id', l.course_interest_id,
    'course_name', crs.name,
    'owner_user_id', l.owner_user_id,
    'owner_name', pr.full_name,
    'status', l.status,
    'temperature', l.temperature,
    'qualification_start_period', l.qualification_start_period,
    'preferred_shift', l.preferred_shift,
    'preferred_modality', l.preferred_modality,
    'budget_notes', l.budget_notes,
    'decision_maker', l.decision_maker,
    'source_detail', l.source_detail,
    'utm_source', l.utm_source,
    'utm_medium', l.utm_medium,
    'utm_campaign', l.utm_campaign,
    'estimated_value', l.estimated_value,
    'proposed_value', l.proposed_value,
    'proposal_sent_at', l.proposal_sent_at,
    'commercial_notes', l.commercial_notes,
    'lost_reason_id', l.lost_reason_id,
    'lost_reason_name', lr.name,
    'lost_notes', l.lost_notes,
    'created_at', to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'updated_at', to_char(l.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'closed_at', l.closed_at,
    'days_in_pipeline', extract(day from now() - l.created_at)::integer,
    'next_activity', (
      select json_build_object(
        'id', a.id, 'type', a.type, 'title', a.title,
        'due_at', a.due_at, 'status', a.status,
        'is_overdue', a.due_at < now()
      )
      from public.crm_activities a
      where a.lead_id = l.id and a.status = 'PENDING'
      order by a.due_at asc limit 1
    ),
    -- Sale fields: no status filter, returns any sale linked to this lead
    'sale_id', s.id,
    'sale_code', s.sale_code,
    'sale_status', s.status,
    'sale_net_value', s.net_value,
    'sale_created_at', s.created_at
  ) into v_result
  from public.crm_leads l
  join public.people p on p.id = l.person_id
  join public.crm_pipeline_stages ps on ps.id = l.stage_id
  left join public.crm_lead_sources cs on cs.id = l.source_id
  left join public.courses crs on crs.id = l.course_interest_id
  left join public.profiles pr on pr.id = l.owner_user_id
  left join public.crm_lost_reasons lr on lr.id = l.lost_reason_id
  left join public.sales s on s.lead_id = l.id
  where l.id = p_lead_id;

  return v_result;
end;
$$;

-- =========================================================================
-- 3. list_sales — page_size cap at 100 + course_name_snapshot
-- =========================================================================
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

  -- Count
  select count(*) into v_total
  from public.sales s
  join public.people p on p.id = s.person_id
  join public.profiles pr on pr.id = s.seller_user_id
  where
    (v_has_view_all or s.seller_user_id = auth.uid())
    and (p_status is null or s.status = p_status)
    and (p_seller_user_id is null or s.seller_user_id = p_seller_user_id)
    and (p_course_id is null or s.course_id = p_course_id)
    and (p_date_from is null or s.sale_date >= p_date_from)
    and (p_date_to is null or s.sale_date <= p_date_to)
    and (p_search is null or p_search = '' or
         s.sale_code ilike '%' || p_search || '%' or
         p.full_name ilike '%' || p_search || '%');

  -- Data: use course_name_snapshot, not courses.name
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
      s.created_at
    from public.sales s
    join public.people p on p.id = s.person_id
    join public.profiles pr on pr.id = s.seller_user_id
    left join public.crm_leads l on l.id = s.lead_id
    where
      (v_has_view_all or s.seller_user_id = auth.uid())
      and (p_status is null or s.status = p_status)
      and (p_seller_user_id is null or s.seller_user_id = p_seller_user_id)
      and (p_course_id is null or s.course_id = p_course_id)
      and (p_date_from is null or s.sale_date >= p_date_from)
      and (p_date_to is null or s.sale_date <= p_date_to)
      and (p_search is null or p_search = '' or
           s.sale_code ilike '%' || p_search || '%' or
           p.full_name ilike '%' || p_search || '%')
    order by s.created_at desc
    limit v_page_size
    offset v_offset
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

-- =========================================================================
-- 4. cancel_sale — 2000 char limit on reason
-- =========================================================================
create or replace function public.cancel_sale(
  p_sale_id            uuid,
  p_cancellation_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sale record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('sales.cancel') then
    raise exception 'Permission denied: sales.cancel' using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;

  if v_sale is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if v_sale.status <> 'CONFIRMED' then
    raise exception 'Only confirmed sales can be canceled' using errcode = '22023';
  end if;

  -- Reason required after trim, non-empty
  if p_cancellation_reason is null or char_length(trim(p_cancellation_reason)) = 0 then
    raise exception 'Cancellation reason is required' using errcode = '22023';
  end if;

  -- Max 2000 chars
  if char_length(trim(p_cancellation_reason)) > 2000 then
    raise exception 'Cancellation reason must be at most 2000 characters' using errcode = '22023';
  end if;

  update public.sales set
    status = 'CANCELED',
    canceled_at = now(),
    canceled_by = auth.uid(),
    cancellation_reason = trim(p_cancellation_reason),
    updated_by = auth.uid()
  where id = p_sale_id;

  perform public.write_audit_log(
    'sales.canceled', 'sale', p_sale_id::text,
    jsonb_build_object(
      'sale_code', v_sale.sale_code,
      'lead_id', v_sale.lead_id::text,
      'cancellation_reason', trim(p_cancellation_reason)
    )
  );
end;
$$;

-- =========================================================================
-- 5. get_sale_timeline — Sale 360 history
-- =========================================================================
create or replace function public.get_sale_timeline(
  p_sale_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_exists boolean;
  v_data json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('sales.view') then
    raise exception 'Permission denied: sales.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('sales.view_all');

  select exists(select 1 from public.sales where id = p_sale_id) into v_exists;
  if not v_exists then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  -- Ownership check
  if not v_has_view_all then
    if not exists (
      select 1 from public.sales where id = p_sale_id and seller_user_id = auth.uid()
    ) then
      raise exception 'Not authorized to view this sale' using errcode = '42501';
    end if;
  end if;

  select json_agg(row_to_json(t)) into v_data
  from (
    select
      al.id,
      al.action as event_type,
      al.created_at as occurred_at,
      case al.action
        when 'sales.created' then 'Venda criada'
        when 'sales.canceled' then 'Venda cancelada'
        else al.action
      end as title,
      case
        when al.action = 'sales.canceled' then al.metadata ->> 'cancellation_reason'
        else null
      end as description,
      al.actor_id as actor_user_id,
      pr.full_name as actor_name,
      al.metadata
    from public.audit_logs al
    left join public.profiles pr on pr.id = al.actor_id
    where al.entity_type = 'sale'
      and al.entity_id = p_sale_id::text
      and al.action in ('sales.created', 'sales.canceled')
    order by al.created_at asc
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'total', coalesce(json_array_length(v_data), 0)
  );
end;
$$;

-- =========================================================================
-- 6. GRANT/REVOKE — only new/changed signatures
-- =========================================================================
revoke execute on function public.cancel_sale(uuid,text) from public, anon;

grant execute on function public.get_sale_timeline(uuid) to authenticated;
revoke execute on function public.get_sale_timeline(uuid) from public, anon;

-- Note: list_sales, get_sale_detail, create_sale_from_lead signatures unchanged
-- Existing GRANTs from previous migration still apply

commit;
