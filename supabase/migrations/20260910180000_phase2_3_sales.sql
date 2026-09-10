-- FASE 2.3: SALES CORE
-- Tabela sales, sequence, permissions, RBAC, 4 RPCs, GRANT/REVOKE
begin;

-- =========================================================================
-- 1. SEQUENCE (concorrente-segura, sem reset anual)
-- =========================================================================
create sequence if not exists public.sale_code_seq as integer;

revoke all on sequence public.sale_code_seq from public, anon, authenticated;

-- =========================================================================
-- 2. TABELA SALES
-- =========================================================================
create table if not exists public.sales (
  id                uuid primary key default gen_random_uuid(),
  sale_code         text not null unique,
  status            text not null default 'CONFIRMED',
  lead_id           uuid not null unique references public.crm_leads(id) on delete restrict,
  person_id         uuid not null references public.people(id),
  student_id        uuid not null references public.students(id),
  course_id         uuid not null references public.courses(id),
  course_name_snapshot  text not null,
  course_price_snapshot numeric(12,2),
  seller_user_id    uuid not null references auth.users(id),
  sale_date         date not null default current_date,
  gross_value       numeric(12,2) not null check (gross_value >= 0),
  discount_value    numeric(12,2) not null default 0 check (discount_value >= 0),
  net_value         numeric(12,2) generated always as (gross_value - discount_value) stored,
  payment_method    text not null check (payment_method in (
    'PIX','DINHEIRO','CARTAO_CREDITO','CARTAO_DEBITO','BOLETO','TRANSFERENCIA','OUTRO'
  )),
  installments      integer not null default 1 check (installments >= 1),
  commercial_notes  text,
  canceled_at       timestamptz,
  canceled_by       uuid references auth.users(id),
  cancellation_reason text,
  created_by        uuid references auth.users(id),
  updated_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Bidirectional constraint: CONFIRMED ↔ canceled_* all NULL, CANCELED ↔ canceled_* required
  constraint sales_status_confirmed_check check (
    (status = 'CONFIRMED' and canceled_at is null and canceled_by is null and cancellation_reason is null)
    or
    (status = 'CANCELED' and canceled_at is not null and canceled_by is not null and cancellation_reason is not null and char_length(trim(cancellation_reason)) > 0)
  ),
  constraint sales_discount_lte_gross check (gross_value >= discount_value)
);

-- Indexes (skip UNIQUEs which already have implicit indexes)
create index if not exists sales_person_id_idx on public.sales(person_id);
create index if not exists sales_student_id_idx on public.sales(student_id);
create index if not exists sales_seller_user_id_idx on public.sales(seller_user_id);
create index if not exists sales_status_idx on public.sales(status);
create index if not exists sales_created_at_idx on public.sales(created_at desc);
create index if not exists sales_status_seller_idx on public.sales(seller_user_id, status);

drop trigger if exists sales_set_updated_at on public.sales;
create trigger sales_set_updated_at before update on public.sales
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 3. RLS — RPC-ONLY: no policies, no direct access
-- =========================================================================
alter table public.sales enable row level security;
revoke all on table public.sales from public, anon, authenticated;

-- =========================================================================
-- 4. PERMISSIONS
-- =========================================================================
insert into public.permissions (code, name, description, module) values
  ('sales.view_all', 'Visualizar todas as vendas', 'Visualizar vendas de outros vendedores.', 'sales'),
  ('sales.cancel', 'Cancelar vendas', 'Cancelar vendas confirmadas.', 'sales')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

-- =========================================================================
-- 5. RBAC MATRIX
-- =========================================================================
with grants(role_code, permission_code) as (values
  -- ADMIN gets everything via cross join below; skip explicit inserts
  -- DIRECAO
  ('DIRECAO','sales.view'),('DIRECAO','sales.view_all'),('DIRECAO','sales.create'),('DIRECAO','sales.approve'),('DIRECAO','sales.cancel'),
  -- GERENTE_COMERCIAL
  ('GERENTE_COMERCIAL','sales.view'),('GERENTE_COMERCIAL','sales.view_all'),('GERENTE_COMERCIAL','sales.create'),('GERENTE_COMERCIAL','sales.approve'),('GERENTE_COMERCIAL','sales.cancel'),
  -- VENDEDOR
  ('VENDEDOR','sales.view'),('VENDEDOR','sales.create'),
  -- RECEPCAO
  ('RECEPCAO','sales.view'),('RECEPCAO','sales.create')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

-- =========================================================================
-- 6. RPC — create_sale_from_lead
-- =========================================================================
create or replace function public.create_sale_from_lead(
  p_lead_id           uuid,
  p_course_id         uuid,
  p_gross_value       numeric(12,2),
  p_payment_method    text,
  p_discount_value    numeric(12,2) default 0,
  p_installments      integer default 1,
  p_commercial_notes  text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead          record;
  v_course        record;
  v_student_id    uuid;
  v_student_code  text;
  v_sale_id       uuid;
  v_sale_code     text;
  v_cancelled     integer;
begin
  -- Auth
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Permission: sales.create
  if not public.has_permission('sales.create') then
    raise exception 'Permission denied: sales.create' using errcode = '42501';
  end if;

  -- Load lead with lock
  select l.*, ps.code as stage_code
  into v_lead
  from public.crm_leads l
  join public.crm_pipeline_stages ps on ps.id = l.stage_id
  where l.id = p_lead_id
  for update;

  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  -- Ownership: owner OR crm.view_all
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.view_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;

  -- Lead must be OPEN
  if v_lead.status <> 'OPEN' then
    raise exception 'Lead is not open' using errcode = '22023';
  end if;

  -- Stage must be PROPOSAL_SENT or NEGOTIATION (literal, no >= comparison)
  if v_lead.stage_code not in ('PROPOSAL_SENT', 'NEGOTIATION') then
    raise exception 'Lead stage must be PROPOSAL_SENT or NEGOTIATION' using errcode = '22023';
  end if;

  -- Validate course
  select * into v_course from public.courses where id = p_course_id;
  if v_course is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;
  if v_course.status <> 'ACTIVE' then
    raise exception 'Course is not active' using errcode = '22023';
  end if;

  -- Validate values
  if p_gross_value is null or p_gross_value <= 0 then
    raise exception 'Gross value must be positive' using errcode = '22023';
  end if;
  if p_discount_value is null or p_discount_value < 0 then
    raise exception 'Discount value must be non-negative' using errcode = '22023';
  end if;
  if p_discount_value > p_gross_value then
    raise exception 'Discount cannot exceed gross value' using errcode = '22023';
  end if;
  if p_installments is null or p_installments < 1 then
    raise exception 'Installments must be at least 1' using errcode = '22023';
  end if;
  if p_payment_method is null or p_payment_method not in ('PIX','DINHEIRO','CARTAO_CREDITO','CARTAO_DEBITO','BOLETO','TRANSFERENCIA','OUTRO') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;

  -- Student creation: concurrency-safe
  -- Try INSERT; if conflict (person already a student), fetch existing
  v_student_code := 'ALU-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.student_code_seq')::text, 6, '0');

  insert into public.students (
    person_id, student_code, status, registration_date, created_by, updated_by
  ) values (
    v_lead.person_id, v_student_code, 'PRE_CADASTRO', current_date, auth.uid(), auth.uid()
  )
  on conflict (person_id) do nothing
  returning id into v_student_id;

  if v_student_id is null then
    -- Student already exists for this person
    select id into v_student_id from public.students where person_id = v_lead.person_id;
  else
    -- Newly created student: record initial status history
    insert into public.student_status_history (student_id, previous_status, new_status, reason, changed_by)
    values (v_student_id, null, 'PRE_CADASTRO', 'Criação automática via venda', auth.uid());
  end if;

  -- Generate sale code: VND-YYYY-NNNNNN
  v_sale_code := 'VND-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.sale_code_seq')::text, 6, '0');

  -- Insert sale
  insert into public.sales (
    sale_code, lead_id, person_id, student_id, course_id,
    course_name_snapshot, course_price_snapshot,
    seller_user_id, sale_date, gross_value, discount_value,
    payment_method, installments, commercial_notes,
    created_by, updated_by
  ) values (
    v_sale_code, p_lead_id, v_lead.person_id, v_student_id, p_course_id,
    v_course.name, v_course.default_price,
    v_lead.owner_user_id, current_date, p_gross_value, p_discount_value,
    p_payment_method, p_installments,
    nullif(trim(coalesce(p_commercial_notes, '')), ''),
    auth.uid(), auth.uid()
  )
  returning id into v_sale_id;

  -- Update lead to WON
  update public.crm_leads set
    status = 'WON',
    closed_at = now(),
    updated_by = auth.uid()
  where id = p_lead_id;

  -- Cancel PENDING activities
  update public.crm_activities set
    status = 'CANCELED',
    updated_by = auth.uid()
  where lead_id = p_lead_id
    and status = 'PENDING';

  get diagnostics v_cancelled = row_count;

  -- Audit: sales.created
  perform public.write_audit_log(
    'sales.created', 'sale', v_sale_id::text,
    jsonb_build_object(
      'sale_code', v_sale_code,
      'lead_id', p_lead_id::text,
      'lead_code', v_lead.lead_code,
      'person_id', v_lead.person_id::text,
      'student_id', v_student_id::text,
      'course_id', p_course_id::text,
      'course_name', v_course.name,
      'gross_value', p_gross_value,
      'discount_value', p_discount_value,
      'net_value', (p_gross_value - p_discount_value),
      'payment_method', p_payment_method,
      'installments', p_installments,
      'cancelled_activities', v_cancelled
    )
  );

  -- Audit: crm.lead_won
  perform public.write_audit_log(
    'crm.lead_won', 'crm_lead', p_lead_id::text,
    jsonb_build_object(
      'sale_id', v_sale_id::text,
      'sale_code', v_sale_code,
      'lead_code', v_lead.lead_code,
      'person_id', v_lead.person_id::text
    )
  );

  return json_build_object('sale_id', v_sale_id, 'sale_code', v_sale_code);
end;
$$;

-- =========================================================================
-- 7. RPC — list_sales
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
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  -- Count
  select count(*) into v_total
  from public.sales s
  join public.people p on p.id = s.person_id
  join public.courses c on c.id = s.course_id
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

  -- Data
  select json_agg(row_to_json(t)) into v_data
  from (
    select
      s.id, s.sale_code, s.status, s.lead_id,
      l.lead_code,
      p.full_name,
      c.name as course_name,
      pr.full_name as seller_name,
      s.sale_date, s.gross_value, s.discount_value, s.net_value,
      s.payment_method, s.installments,
      s.created_at
    from public.sales s
    join public.people p on p.id = s.person_id
    join public.courses c on c.id = s.course_id
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
    limit greatest(p_page_size, 1)
    offset v_offset
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'total', v_total,
    'page', greatest(p_page, 1),
    'page_size', greatest(p_page_size, 1)
  );
end;
$$;

-- =========================================================================
-- 8. RPC — get_sale_detail
-- =========================================================================
create or replace function public.get_sale_detail(
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
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('sales.view') then
    raise exception 'Permission denied: sales.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('sales.view_all');

  select json_build_object(
    'id', s.id,
    'sale_code', s.sale_code,
    'status', s.status,
    'lead_id', s.lead_id,
    'lead_code', l.lead_code,
    'person_id', s.person_id,
    'full_name', p.full_name,
    'student_id', s.student_id,
    'student_code', st.student_code,
    'course_id', s.course_id,
    'course_name_snapshot', s.course_name_snapshot,
    'course_price_snapshot', s.course_price_snapshot,
    'seller_user_id', s.seller_user_id,
    'seller_name', sp.full_name,
    'sale_date', to_char(s.sale_date, 'YYYY-MM-DD'),
    'gross_value', s.gross_value,
    'discount_value', s.discount_value,
    'net_value', s.net_value,
    'payment_method', s.payment_method,
    'installments', s.installments,
    'commercial_notes', s.commercial_notes,
    'canceled_at', s.canceled_at,
    'canceled_by', s.canceled_by,
    'canceled_by_name', cp.full_name,
    'cancellation_reason', s.cancellation_reason,
    'created_by', s.created_by,
    'created_by_name', crp.full_name,
    'created_at', s.created_at,
    'updated_at', s.updated_at
  ) into v_result
  from public.sales s
  join public.people p on p.id = s.person_id
  join public.students st on st.id = s.student_id
  join public.profiles sp on sp.id = s.seller_user_id
  left join public.crm_leads l on l.id = s.lead_id
  left join public.profiles cp on cp.id = s.canceled_by
  left join public.profiles crp on crp.id = s.created_by
  where s.id = p_sale_id;

  if v_result is null then
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

  return v_result;
end;
$$;

-- =========================================================================
-- 9. RPC — cancel_sale
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

  -- Update sale: status -> CANCELED, fill canceled_* fields (bidirectional constraint will validate)
  update public.sales set
    status = 'CANCELED',
    canceled_at = now(),
    canceled_by = auth.uid(),
    cancellation_reason = trim(p_cancellation_reason),
    updated_by = auth.uid()
  where id = p_sale_id;

  -- Lead stays WON — no change
  -- Student stays — no change

  -- Audit: sales.canceled
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
-- 10. GRANT/REVOKE — revoke specific signatures only
-- =========================================================================
revoke execute on function public.create_sale_from_lead(uuid,uuid,numeric,text,numeric,integer,text) from public, anon;
revoke execute on function public.list_sales(text,text,uuid,uuid,date,date,integer,integer) from public, anon;
revoke execute on function public.get_sale_detail(uuid) from public, anon;
revoke execute on function public.cancel_sale(uuid,text) from public, anon;

grant execute on function public.create_sale_from_lead(uuid,uuid,numeric,text,numeric,integer,text) to authenticated;
grant execute on function public.list_sales(text,text,uuid,uuid,date,date,integer,integer) to authenticated;
grant execute on function public.get_sale_detail(uuid) to authenticated;
grant execute on function public.cancel_sale(uuid,text) to authenticated;

commit;
