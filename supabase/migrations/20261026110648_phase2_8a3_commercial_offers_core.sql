begin;

-- FASE 2.8A.3 — núcleo de ofertas comerciais.
-- Infraestrutura: nenhuma oferta, condição ou preço é cadastrada nesta fase.

create table if not exists public.course_offers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  course_id uuid references public.courses(id) on delete restrict,
  offer_type text not null,
  status text not null default 'DRAFT',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint course_offers_code_length check (char_length(code) between 1 and 80),
  constraint course_offers_name_length check (char_length(name) between 1 and 200),
  constraint course_offers_type_check check (offer_type in (
    'COURSE','ONLINE_CATALOG','PROGRAM','SERVICE','MODULE','OTHER'
  )),
  constraint course_offers_status_check check (status in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED')),
  constraint course_offers_course_relation_check check (
    (offer_type = 'COURSE' and course_id is not null)
    or
    (offer_type <> 'COURSE' and course_id is null)
  ),
  constraint course_offers_validity_check check (valid_until is null or valid_until > valid_from)
);

create index if not exists course_offers_status_validity_idx
  on public.course_offers(status, valid_from, valid_until);
create index if not exists course_offers_course_id_idx
  on public.course_offers(course_id)
  where course_id is not null;

drop trigger if exists course_offers_set_updated_at on public.course_offers;
create trigger course_offers_set_updated_at before update on public.course_offers
  for each row execute function public.set_updated_at();

create table if not exists public.offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.course_offers(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  selection_mode text not null,
  min_quantity integer,
  max_quantity integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint offer_items_selection_mode_check check (selection_mode in ('INCLUDED','SELECTABLE')),
  constraint offer_items_min_quantity_check check (min_quantity is null or min_quantity >= 1),
  constraint offer_items_max_quantity_check check (max_quantity is null or max_quantity >= 1),
  constraint offer_items_quantity_range_check check (
    min_quantity is null or max_quantity is null or max_quantity >= min_quantity
  ),
  constraint offer_items_sort_order_check check (sort_order >= 0),
  constraint offer_items_offer_course_unique unique (offer_id, course_id)
);

create index if not exists offer_items_offer_id_idx on public.offer_items(offer_id, sort_order);
create index if not exists offer_items_course_id_idx on public.offer_items(course_id);

create table if not exists public.price_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  offer_id uuid not null references public.course_offers(id) on delete restrict,
  payment_method text not null,
  pricing_model text not null,
  cash_price numeric(12,2),
  enrollment_fee numeric(12,2),
  installment_count integer,
  installment_amount numeric(12,2),
  total_amount numeric(12,2) not null,
  quantity_min integer,
  quantity_max integer,
  status text not null default 'DRAFT',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint price_plans_code_length check (char_length(code) between 1 and 80),
  constraint price_plans_payment_method_check check (payment_method in (
    'PIX','CASH','DEBIT','BOLETO','CREDIT_CARD','OTHER'
  )),
  constraint price_plans_pricing_model_check check (pricing_model in (
    'CASH','FIXED_INSTALLMENT','EXPLICIT_CARD_INSTALLMENT','QUANTITY_TIER'
  )),
  constraint price_plans_status_check check (status in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED')),
  constraint price_plans_cash_price_check check (cash_price is null or (cash_price >= 0 and cash_price <> 'NaN'::numeric and cash_price <> 'Infinity'::numeric)),
  constraint price_plans_enrollment_fee_check check (enrollment_fee is null or (enrollment_fee >= 0 and enrollment_fee <> 'NaN'::numeric and enrollment_fee <> 'Infinity'::numeric)),
  constraint price_plans_installment_count_check check (installment_count is null or installment_count >= 1),
  constraint price_plans_installment_amount_check check (installment_amount is null or (installment_amount >= 0 and installment_amount <> 'NaN'::numeric and installment_amount <> 'Infinity'::numeric)),
  constraint price_plans_total_amount_check check (total_amount >= 0 and total_amount <> 'NaN'::numeric and total_amount <> 'Infinity'::numeric),
  constraint price_plans_quantity_min_check check (quantity_min is null or quantity_min >= 1),
  constraint price_plans_quantity_max_check check (quantity_max is null or quantity_max >= 1),
  constraint price_plans_quantity_range_check check (
    quantity_min is null or quantity_max is null or quantity_max >= quantity_min
  ),
  constraint price_plans_quantity_model_check check (
    (pricing_model = 'QUANTITY_TIER' and quantity_min is not null and quantity_max is not null)
    or
    (pricing_model <> 'QUANTITY_TIER' and quantity_min is null and quantity_max is null)
  ),
  constraint price_plans_cash_model_check check (
    (pricing_model = 'CASH'
      and cash_price is not null
      and installment_count is null
      and installment_amount is null
      and total_amount = cash_price + coalesce(enrollment_fee, 0))
    or pricing_model <> 'CASH'
  ),
  constraint price_plans_installment_model_check check (
    (pricing_model in ('FIXED_INSTALLMENT', 'EXPLICIT_CARD_INSTALLMENT')
      and installment_count is not null
      and installment_amount is not null)
    or pricing_model not in ('FIXED_INSTALLMENT', 'EXPLICIT_CARD_INSTALLMENT')
  ),
  constraint price_plans_card_model_check check (
    pricing_model <> 'EXPLICIT_CARD_INSTALLMENT' or payment_method = 'CREDIT_CARD'
  ),
  constraint price_plans_validity_check check (valid_until is null or valid_until > valid_from)
);

create index if not exists price_plans_offer_status_idx
  on public.price_plans(offer_id, status, valid_from, valid_until);

drop trigger if exists price_plans_set_updated_at on public.price_plans;
create trigger price_plans_set_updated_at before update on public.price_plans
  for each row execute function public.set_updated_at();

create table if not exists public.price_plan_installments (
  id uuid primary key default gen_random_uuid(),
  price_plan_id uuid not null references public.price_plans(id) on delete restrict,
  installment_number integer not null,
  due_offset_days integer,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint price_plan_installments_number_check check (installment_number >= 1),
  constraint price_plan_installments_due_offset_check check (due_offset_days is null or due_offset_days >= 0),
  constraint price_plan_installments_amount_check check (amount >= 0 and amount <> 'NaN'::numeric and amount <> 'Infinity'::numeric),
  constraint price_plan_installments_unique unique (price_plan_id, installment_number)
);

create index if not exists price_plan_installments_plan_idx
  on public.price_plan_installments(price_plan_id, installment_number);

-- Installment rows are optional detail: the plan-level count/amount remains the
-- canonical summary. When detail rows are supplied, they are allowed only for
-- installment models and cannot exceed installment_count.
create or replace function public.validate_price_plan_installment()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare v_plan public.price_plans%rowtype;
begin
  select * into v_plan from public.price_plans where id = new.price_plan_id;
  if not found then raise exception 'Price plan not found' using errcode = 'P0002'; end if;
  if v_plan.pricing_model not in ('FIXED_INSTALLMENT', 'EXPLICIT_CARD_INSTALLMENT') then
    raise exception 'Installment detail requires an installment pricing model' using errcode = '22023';
  end if;
  if v_plan.installment_count is null or new.installment_number > v_plan.installment_count then
    raise exception 'Installment number exceeds installment_count' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists price_plan_installments_validate on public.price_plan_installments;
create trigger price_plan_installments_validate
  before insert or update on public.price_plan_installments
  for each row execute function public.validate_price_plan_installment();

revoke all on function public.validate_price_plan_installment() from public, anon, authenticated;

-- Prevent equivalent ACTIVE plans from having overlapping validity windows.
create or replace function public.prevent_active_price_plan_overlap()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'ACTIVE' then
    perform pg_advisory_xact_lock(hashtextextended(
      concat_ws(':', new.offer_id::text, new.payment_method, new.pricing_model,
        coalesce(new.quantity_min::text, '*'), coalesce(new.quantity_max::text, '*')), 0));
    if exists (
      select 1 from public.price_plans existing
      where existing.id <> new.id
        and existing.status = 'ACTIVE'
        and existing.offer_id = new.offer_id
        and existing.payment_method = new.payment_method
        and existing.pricing_model = new.pricing_model
        and existing.quantity_min is not distinct from new.quantity_min
        and existing.quantity_max is not distinct from new.quantity_max
        and tstzrange(existing.valid_from, coalesce(existing.valid_until, 'infinity'::timestamptz), '[)')
          && tstzrange(new.valid_from, coalesce(new.valid_until, 'infinity'::timestamptz), '[)')
    ) then
      raise exception 'An equivalent active price plan already overlaps this validity period'
        using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists price_plans_prevent_active_overlap on public.price_plans;
create trigger price_plans_prevent_active_overlap
  before insert or update on public.price_plans
  for each row execute function public.prevent_active_price_plan_overlap();

revoke all on function public.prevent_active_price_plan_overlap() from public, anon, authenticated;

-- RPC-only: as tabelas não ficam diretamente editáveis por authenticated.
alter table public.course_offers enable row level security;
alter table public.offer_items enable row level security;
alter table public.price_plans enable row level security;
alter table public.price_plan_installments enable row level security;

revoke all on table public.course_offers from public, anon, authenticated;
revoke all on table public.offer_items from public, anon, authenticated;
revoke all on table public.price_plans from public, anon, authenticated;
revoke all on table public.price_plan_installments from public, anon, authenticated;

insert into public.permissions (code, name, description, module) values
  ('course_offers.view', 'Visualizar ofertas comerciais', 'Consultar ofertas comerciais autorizadas.', 'commercial_offers'),
  ('course_offers.manage', 'Gerenciar ofertas comerciais', 'Criar e editar ofertas comerciais em rascunho.', 'commercial_offers'),
  ('course_offers.activate', 'Ativar ofertas comerciais', 'Ativar, desativar ou arquivar ofertas comerciais.', 'commercial_offers'),
  ('price_plans.view', 'Visualizar planos de preço', 'Consultar condições de pagamento autorizadas.', 'commercial_offers'),
  ('price_plans.manage', 'Gerenciar planos de preço', 'Criar e editar planos de preço em rascunho.', 'commercial_offers'),
  ('price_plans.activate', 'Ativar planos de preço', 'Ativar, desativar ou arquivar planos de preço.', 'commercial_offers')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'ADMIN'
  and p.code in (
    'course_offers.view','course_offers.manage','course_offers.activate',
    'price_plans.view','price_plans.manage','price_plans.activate'
  )
on conflict do nothing;

with grants(role_code, permission_code) as (values
  ('VENDEDOR','course_offers.view'),('VENDEDOR','price_plans.view'),
  ('GERENTE_COMERCIAL','course_offers.view'),('GERENTE_COMERCIAL','course_offers.manage'),('GERENTE_COMERCIAL','course_offers.activate'),
  ('GERENTE_COMERCIAL','price_plans.view'),('GERENTE_COMERCIAL','price_plans.manage'),('GERENTE_COMERCIAL','price_plans.activate'),
  ('DIRECAO','course_offers.view'),('DIRECAO','course_offers.manage'),('DIRECAO','course_offers.activate'),
  ('DIRECAO','price_plans.view'),('DIRECAO','price_plans.manage'),('DIRECAO','price_plans.activate')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

create or replace function public.list_course_offers(p_status text default 'ACTIVE')
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_rows json;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('course_offers.view') then raise exception 'Permission denied: course_offers.view' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED') then
    raise exception 'Invalid offer status' using errcode = '22023';
  end if;

  v_rows := coalesce(json_agg(row_to_json(o) order by o.name), '[]'::json)
  from (
    select co.id, co.code, co.name, co.course_id, co.offer_type, co.status,
      co.valid_from, co.valid_until, co.created_at, co.updated_at
    from public.course_offers co
    where (p_status is null or co.status = p_status)
      and (p_status is distinct from 'ACTIVE' or (co.valid_from <= now() and (co.valid_until is null or co.valid_until > now())))
    order by co.name
  ) o;
  return v_rows;
end;
$$;

create or replace function public.list_price_plans(p_offer_id uuid, p_status text default 'ACTIVE')
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_rows json;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('price_plans.view') then raise exception 'Permission denied: price_plans.view' using errcode = '42501'; end if;
  if p_offer_id is null then raise exception 'Offer id is required' using errcode = '22023'; end if;
  if p_status is not null and p_status not in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED') then
    raise exception 'Invalid price plan status' using errcode = '22023';
  end if;

  v_rows := coalesce(json_agg(row_to_json(pp) order by pp.code), '[]'::json)
  from (
    select p.id, p.code, p.offer_id, p.payment_method, p.pricing_model,
      p.cash_price, p.enrollment_fee, p.installment_count, p.installment_amount,
      p.total_amount, p.quantity_min, p.quantity_max, p.status, p.valid_from, p.valid_until,
      p.created_at, p.updated_at
    from public.price_plans p
    where p.offer_id = p_offer_id
      and (p_status is null or p.status = p_status)
      and (p_status is distinct from 'ACTIVE' or (p.valid_from <= now() and (p.valid_until is null or p.valid_until > now())))
    order by p.code
  ) pp;
  return v_rows;
end;
$$;

create or replace function public.create_course_offer(
  p_code text, p_name text, p_course_id uuid default null,
  p_offer_type text default 'COURSE', p_valid_from timestamptz default now(), p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('course_offers.manage') then raise exception 'Permission denied: course_offers.manage' using errcode = '42501'; end if;
  if p_code is null or char_length(trim(p_code)) = 0 then raise exception 'Offer code is required' using errcode = '22023'; end if;
  if p_name is null or char_length(trim(p_name)) = 0 then raise exception 'Offer name is required' using errcode = '22023'; end if;
  if p_offer_type not in ('COURSE','ONLINE_CATALOG','PROGRAM','SERVICE','MODULE','OTHER') then raise exception 'Invalid offer type' using errcode = '22023'; end if;
  if p_offer_type = 'COURSE' and p_course_id is null then raise exception 'Course id is required for COURSE offers' using errcode = '22023'; end if;
  if p_offer_type <> 'COURSE' and p_course_id is not null then raise exception 'Only COURSE offers may reference a course' using errcode = '22023'; end if;
  if p_valid_until is not null and p_valid_until <= p_valid_from then raise exception 'Offer validity is invalid' using errcode = '22023'; end if;
  insert into public.course_offers(code,name,course_id,offer_type,status,valid_from,valid_until,created_by,updated_by)
  values (upper(trim(p_code)), trim(p_name), p_course_id, p_offer_type, 'DRAFT', p_valid_from, p_valid_until, auth.uid(), auth.uid())
  returning id into v_id;
  perform public.write_audit_log('commercial.course_offer_created','course_offer',v_id::text,jsonb_build_object('code',upper(trim(p_code))));
  return v_id;
end;
$$;

create or replace function public.update_course_offer(
  p_offer_id uuid, p_name text default null, p_course_id uuid default null,
  p_offer_type text default null, p_valid_from timestamptz default null, p_valid_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare v_offer public.course_offers%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('course_offers.manage') then raise exception 'Permission denied: course_offers.manage' using errcode = '42501'; end if;
  select * into v_offer from public.course_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if v_offer.status <> 'DRAFT' then raise exception 'Only DRAFT offers can be edited' using errcode = '22023'; end if;
  if p_name is not null and char_length(trim(p_name)) = 0 then raise exception 'Offer name is invalid' using errcode = '22023'; end if;
  if p_offer_type is not null and p_offer_type not in ('COURSE','ONLINE_CATALOG','PROGRAM','SERVICE','MODULE','OTHER') then raise exception 'Invalid offer type' using errcode = '22023'; end if;
  if coalesce(p_offer_type,v_offer.offer_type) = 'COURSE' and coalesce(p_course_id,v_offer.course_id) is null then raise exception 'Course id is required for COURSE offers' using errcode = '22023'; end if;
  if coalesce(p_offer_type,v_offer.offer_type) <> 'COURSE' and p_course_id is not null then raise exception 'Only COURSE offers may reference a course' using errcode = '22023'; end if;
  if coalesce(p_valid_until,v_offer.valid_until) is not null and coalesce(p_valid_from,v_offer.valid_from) >= coalesce(p_valid_until,v_offer.valid_until) then raise exception 'Offer validity is invalid' using errcode = '22023'; end if;
  update public.course_offers set name=coalesce(trim(p_name),name), course_id=case when coalesce(p_offer_type,v_offer.offer_type) <> 'COURSE' then null else coalesce(p_course_id,course_id) end, offer_type=coalesce(p_offer_type,offer_type), valid_from=coalesce(p_valid_from,valid_from), valid_until=coalesce(p_valid_until,valid_until), updated_by=auth.uid() where id=p_offer_id;
  perform public.write_audit_log('commercial.course_offer_updated','course_offer',p_offer_id::text,jsonb_build_object());
end;
$$;

create or replace function public.activate_course_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('course_offers.activate') then raise exception 'Permission denied: course_offers.activate' using errcode = '42501'; end if;
  update public.course_offers set status='ACTIVE', updated_by=auth.uid() where id=p_offer_id and status in ('DRAFT','INACTIVE') and valid_from <= now() and (valid_until is null or valid_until > now());
  if not found then raise exception 'Offer not found or not activatable' using errcode = 'P0002'; end if;
  perform public.write_audit_log('commercial.course_offer_activated','course_offer',p_offer_id::text,jsonb_build_object());
end;
$$;

create or replace function public.deactivate_course_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('course_offers.activate') then raise exception 'Permission denied: course_offers.activate' using errcode = '42501'; end if;
  update public.course_offers set status='INACTIVE', updated_by=auth.uid() where id=p_offer_id and status='ACTIVE';
  if not found then raise exception 'Active offer not found' using errcode = 'P0002'; end if;
  perform public.write_audit_log('commercial.course_offer_deactivated','course_offer',p_offer_id::text,jsonb_build_object());
end;
$$;

create or replace function public.create_price_plan(
  p_code text, p_offer_id uuid, p_payment_method text, p_pricing_model text,
  p_total_amount numeric, p_cash_price numeric default null, p_enrollment_fee numeric default null,
  p_installment_count integer default null, p_installment_amount numeric default null,
  p_quantity_min integer default null, p_quantity_max integer default null,
  p_valid_from timestamptz default now(), p_valid_until timestamptz default null
)
returns uuid language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('price_plans.manage') then raise exception 'Permission denied: price_plans.manage' using errcode = '42501'; end if;
  if p_code is null or char_length(trim(p_code)) = 0 then raise exception 'Price plan code is required' using errcode = '22023'; end if;
  if p_offer_id is null or not exists(select 1 from public.course_offers where id=p_offer_id) then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if p_payment_method not in ('PIX','CASH','DEBIT','BOLETO','CREDIT_CARD','OTHER') then raise exception 'Invalid payment method' using errcode = '22023'; end if;
  if p_pricing_model not in ('CASH','FIXED_INSTALLMENT','EXPLICIT_CARD_INSTALLMENT','QUANTITY_TIER') then raise exception 'Invalid pricing model' using errcode = '22023'; end if;
  if p_pricing_model = 'EXPLICIT_CARD_INSTALLMENT' and p_payment_method <> 'CREDIT_CARD' then raise exception 'EXPLICIT_CARD_INSTALLMENT requires CREDIT_CARD' using errcode = '22023'; end if;
  if p_pricing_model in ('FIXED_INSTALLMENT','EXPLICIT_CARD_INSTALLMENT') and (p_installment_count is null or p_installment_amount is null) then raise exception 'Installment count and amount are required for installment plans' using errcode = '22023'; end if;
  if p_pricing_model = 'CASH' and (p_cash_price is null or p_installment_count is not null or p_installment_amount is not null) then raise exception 'CASH plans require cash_price and no installment fields' using errcode = '22023'; end if;
  if p_pricing_model = 'CASH' and p_total_amount <> p_cash_price + coalesce(p_enrollment_fee, 0) then raise exception 'CASH total must equal cash_price plus enrollment_fee' using errcode = '22023'; end if;
  if p_total_amount is null or p_total_amount < 0 then raise exception 'Total amount is invalid' using errcode = '22023'; end if;
  if p_valid_until is not null and p_valid_until <= p_valid_from then raise exception 'Price plan validity is invalid' using errcode = '22023'; end if;
  if p_pricing_model = 'QUANTITY_TIER' and (p_quantity_min is null or p_quantity_max is null) then raise exception 'Quantity range is required' using errcode = '22023'; end if;
  if p_pricing_model = 'QUANTITY_TIER' and p_quantity_max < p_quantity_min then raise exception 'Quantity range is invalid' using errcode = '22023'; end if;
  insert into public.price_plans(code,offer_id,payment_method,pricing_model,cash_price,enrollment_fee,installment_count,installment_amount,total_amount,quantity_min,quantity_max,status,valid_from,valid_until,created_by,updated_by)
  values (upper(trim(p_code)),p_offer_id,p_payment_method,p_pricing_model,p_cash_price,p_enrollment_fee,p_installment_count,p_installment_amount,p_total_amount,p_quantity_min,p_quantity_max,'DRAFT',p_valid_from,p_valid_until,auth.uid(),auth.uid()) returning id into v_id;
  perform public.write_audit_log('commercial.price_plan_created','price_plan',v_id::text,jsonb_build_object('code',upper(trim(p_code)),'offer_id',p_offer_id::text));
  return v_id;
end;
$$;

create or replace function public.update_price_plan(
  p_price_plan_id uuid, p_payment_method text default null, p_pricing_model text default null,
  p_total_amount numeric default null, p_cash_price numeric default null, p_enrollment_fee numeric default null,
  p_installment_count integer default null, p_installment_amount numeric default null,
  p_quantity_min integer default null, p_quantity_max integer default null,
  p_valid_from timestamptz default null, p_valid_until timestamptz default null
)
returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
declare v_plan public.price_plans%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('price_plans.manage') then raise exception 'Permission denied: price_plans.manage' using errcode = '42501'; end if;
  select * into v_plan from public.price_plans where id=p_price_plan_id for update;
  if not found then raise exception 'Price plan not found' using errcode = 'P0002'; end if;
  if v_plan.status <> 'DRAFT' then raise exception 'Only DRAFT price plans can be edited' using errcode = '22023'; end if;
  if p_payment_method is not null and p_payment_method not in ('PIX','CASH','DEBIT','BOLETO','CREDIT_CARD','OTHER') then raise exception 'Invalid payment method' using errcode = '22023'; end if;
  if p_pricing_model is not null and p_pricing_model not in ('CASH','FIXED_INSTALLMENT','EXPLICIT_CARD_INSTALLMENT','QUANTITY_TIER') then raise exception 'Invalid pricing model' using errcode = '22023'; end if;
  if coalesce(p_pricing_model,v_plan.pricing_model) = 'EXPLICIT_CARD_INSTALLMENT' and coalesce(p_payment_method,v_plan.payment_method) <> 'CREDIT_CARD' then raise exception 'EXPLICIT_CARD_INSTALLMENT requires CREDIT_CARD' using errcode = '22023'; end if;
  if coalesce(p_pricing_model,v_plan.pricing_model) in ('FIXED_INSTALLMENT','EXPLICIT_CARD_INSTALLMENT') and (coalesce(p_installment_count,v_plan.installment_count) is null or coalesce(p_installment_amount,v_plan.installment_amount) is null) then raise exception 'Installment count and amount are required for installment plans' using errcode = '22023'; end if;
  if coalesce(p_pricing_model,v_plan.pricing_model) = 'CASH' and coalesce(p_cash_price,v_plan.cash_price) is null then raise exception 'CASH plans require cash_price and no installment fields' using errcode = '22023'; end if;
  if coalesce(p_pricing_model,v_plan.pricing_model) = 'CASH' and coalesce(p_total_amount,v_plan.total_amount) <> coalesce(p_cash_price,v_plan.cash_price) + coalesce(p_enrollment_fee,v_plan.enrollment_fee, 0) then raise exception 'CASH total must equal cash_price plus enrollment_fee' using errcode = '22023'; end if;
  if coalesce(p_total_amount,v_plan.total_amount) < 0 then raise exception 'Total amount is invalid' using errcode = '22023'; end if;
  if coalesce(p_valid_until,v_plan.valid_until) is not null and coalesce(p_valid_from,v_plan.valid_from) >= coalesce(p_valid_until,v_plan.valid_until) then raise exception 'Price plan validity is invalid' using errcode = '22023'; end if;
  if coalesce(p_quantity_max,v_plan.quantity_max) is not null and coalesce(p_quantity_min,v_plan.quantity_min) is not null and coalesce(p_quantity_max,v_plan.quantity_max) < coalesce(p_quantity_min,v_plan.quantity_min) then raise exception 'Quantity range is invalid' using errcode = '22023'; end if;
  if coalesce(p_pricing_model,v_plan.pricing_model) not in ('FIXED_INSTALLMENT','EXPLICIT_CARD_INSTALLMENT') and exists (select 1 from public.price_plan_installments i where i.price_plan_id = p_price_plan_id) then raise exception 'Cannot change a plan with installment details to a non-installment model' using errcode = '22023'; end if;
  if coalesce(p_installment_count,v_plan.installment_count) is not null and exists (select 1 from public.price_plan_installments i where i.price_plan_id = p_price_plan_id and i.installment_number > coalesce(p_installment_count,v_plan.installment_count)) then raise exception 'installment_count cannot remove existing installment details' using errcode = '22023'; end if;
  update public.price_plans set
    payment_method=coalesce(p_payment_method,payment_method),
    pricing_model=coalesce(p_pricing_model,pricing_model),
    total_amount=coalesce(p_total_amount,total_amount),
    cash_price=coalesce(p_cash_price,cash_price),
    enrollment_fee=coalesce(p_enrollment_fee,enrollment_fee),
    installment_count=case when coalesce(p_pricing_model,pricing_model) = 'CASH' then null else coalesce(p_installment_count,installment_count) end,
    installment_amount=case when coalesce(p_pricing_model,pricing_model) = 'CASH' then null else coalesce(p_installment_amount,installment_amount) end,
    quantity_min=case when coalesce(p_pricing_model,pricing_model) = 'QUANTITY_TIER' then coalesce(p_quantity_min,quantity_min) else null end,
    quantity_max=case when coalesce(p_pricing_model,pricing_model) = 'QUANTITY_TIER' then coalesce(p_quantity_max,quantity_max) else null end,
    valid_from=coalesce(p_valid_from,valid_from), valid_until=coalesce(p_valid_until,valid_until), updated_by=auth.uid()
  where id=p_price_plan_id;
  perform public.write_audit_log('commercial.price_plan_updated','price_plan',p_price_plan_id::text,jsonb_build_object());
end;
$$;

create or replace function public.activate_price_plan(p_price_plan_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('price_plans.activate') then raise exception 'Permission denied: price_plans.activate' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.price_plans p join public.course_offers o on o.id = p.offer_id
    where p.id = p_price_plan_id and p.status in ('DRAFT','INACTIVE')
      and o.status = 'ACTIVE' and o.valid_from <= now() and (o.valid_until is null or o.valid_until > now())
      and p.valid_from <= now() and (p.valid_until is null or p.valid_until > now())
  ) then raise exception 'Price plan requires a current ACTIVE offer and validity period' using errcode = '22023'; end if;
  update public.price_plans set status='ACTIVE', updated_by=auth.uid() where id=p_price_plan_id and status in ('DRAFT','INACTIVE');
  if not found then raise exception 'Price plan not found or not activatable' using errcode = 'P0002'; end if;
  perform public.write_audit_log('commercial.price_plan_activated','price_plan',p_price_plan_id::text,jsonb_build_object());
end;
$$;

create or replace function public.deactivate_price_plan(p_price_plan_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('price_plans.activate') then raise exception 'Permission denied: price_plans.activate' using errcode = '42501'; end if;
  update public.price_plans set status='INACTIVE', updated_by=auth.uid() where id=p_price_plan_id and status='ACTIVE';
  if not found then raise exception 'Active price plan not found' using errcode = 'P0002'; end if;
  perform public.write_audit_log('commercial.price_plan_deactivated','price_plan',p_price_plan_id::text,jsonb_build_object());
end;
$$;

revoke all on function public.list_course_offers(text) from public, anon, authenticated;
revoke all on function public.list_price_plans(uuid,text) from public, anon, authenticated;
revoke all on function public.create_course_offer(text,text,uuid,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.update_course_offer(uuid,text,uuid,text,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.activate_course_offer(uuid) from public, anon, authenticated;
revoke all on function public.deactivate_course_offer(uuid) from public, anon, authenticated;
revoke all on function public.create_price_plan(text,uuid,text,text,numeric,numeric,numeric,integer,numeric,integer,integer,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.update_price_plan(uuid,text,text,numeric,numeric,numeric,integer,numeric,integer,integer,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.activate_price_plan(uuid) from public, anon, authenticated;
revoke all on function public.deactivate_price_plan(uuid) from public, anon, authenticated;

grant execute on function public.list_course_offers(text) to authenticated;
grant execute on function public.list_price_plans(uuid,text) to authenticated;
grant execute on function public.create_course_offer(text,text,uuid,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.update_course_offer(uuid,text,uuid,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.activate_course_offer(uuid) to authenticated;
grant execute on function public.deactivate_course_offer(uuid) to authenticated;
grant execute on function public.create_price_plan(text,uuid,text,text,numeric,numeric,numeric,integer,numeric,integer,integer,timestamptz,timestamptz) to authenticated;
grant execute on function public.update_price_plan(uuid,text,text,numeric,numeric,numeric,integer,numeric,integer,integer,timestamptz,timestamptz) to authenticated;
grant execute on function public.activate_price_plan(uuid) to authenticated;
grant execute on function public.deactivate_price_plan(uuid) to authenticated;

commit;
