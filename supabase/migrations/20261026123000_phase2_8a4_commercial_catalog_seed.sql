begin;

-- FASE 2.8A.4 — carga comercial controlada.
--
-- Fonte: Tabela Profissionaliza ABRIL 2026 (PDF não versionado).
-- Todas as ofertas/condições entram como DRAFT. Nenhum preço é ativado nesta fase.
-- A carga é determinística, idempotente e falha em qualquer conflito divergente.
-- `OTHER` nos planos CASH representa literalmente a condição à vista agrupada
-- no PDF como "PIX, DÉBITO, ESPÉCIE", sem inventar um meio específico.
-- `price_plan_installments` permanece vazio: os planos têm parcelas uniformes
-- resumidas em installment_count/installment_amount; o detalhe será usado para
-- cronogramas heterogêneos em fase posterior.

-- O catálogo ONLINE precisa representar cartão por faixa de quantidade.
-- Mantemos EXPLICIT_CARD_INSTALLMENT e permitimos quantity_min/max nesse modelo;
-- planos explícitos regulares continuam usando a faixa nula.
alter table public.price_plans drop constraint if exists price_plans_quantity_model_check;
alter table public.price_plans add constraint price_plans_quantity_model_check check (
  (pricing_model = 'QUANTITY_TIER' and quantity_min is not null and quantity_max is not null)
  or
  (pricing_model = 'EXPLICIT_CARD_INSTALLMENT'
    and ((quantity_min is null and quantity_max is null)
      or (quantity_min is not null and quantity_max is not null)))
  or
  (pricing_model not in ('QUANTITY_TIER', 'EXPLICIT_CARD_INSTALLMENT')
    and quantity_min is null and quantity_max is null)
);

-- Keep the RPC aligned with the expanded explicit-card representation.
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
    payment_method=coalesce(p_payment_method,payment_method), pricing_model=coalesce(p_pricing_model,pricing_model),
    total_amount=coalesce(p_total_amount,total_amount), cash_price=coalesce(p_cash_price,cash_price),
    enrollment_fee=coalesce(p_enrollment_fee,enrollment_fee),
    installment_count=case when coalesce(p_pricing_model,pricing_model) = 'CASH' then null else coalesce(p_installment_count,installment_count) end,
    installment_amount=case when coalesce(p_pricing_model,pricing_model) = 'CASH' then null else coalesce(p_installment_amount,installment_amount) end,
    quantity_min=case when coalesce(p_pricing_model,pricing_model) in ('QUANTITY_TIER','EXPLICIT_CARD_INSTALLMENT') then coalesce(p_quantity_min,quantity_min) else null end,
    quantity_max=case when coalesce(p_pricing_model,pricing_model) in ('QUANTITY_TIER','EXPLICIT_CARD_INSTALLMENT') then coalesce(p_quantity_max,quantity_max) else null end,
    valid_from=coalesce(p_valid_from,valid_from), valid_until=coalesce(p_valid_until,valid_until), updated_by=auth.uid()
  where id=p_price_plan_id;
  perform public.write_audit_log('commercial.price_plan_updated','price_plan',p_price_plan_id::text,jsonb_build_object());
end;
$$;

do $$
declare
  v_valid_from constant timestamptz := '2026-04-01 00:00:00+00'::timestamptz;
  v_offer public.course_offers%rowtype;
  v_course uuid;
  r record;
  v_offers jsonb := '[
    {"code":"OFR-CUR-00001","course_code":"CUR-00001","name":"Estética e Beleza","review":null},
    {"code":"OFR-CUR-00002","course_code":"CUR-00002","name":"Cabeleireiro","review":null},
    {"code":"OFR-CUR-00003","course_code":"CUR-00003","name":"Barbeiro","review":null},
    {"code":"OFR-CUR-00004","course_code":"CUR-00004","name":"Atendente de Farmácia","review":null},
    {"code":"OFR-CUR-00005","course_code":"CUR-00005","name":"Máquinas Pesadas","review":null},
    {"code":"OFR-CUR-00006","course_code":"CUR-00006","name":"Auxiliar de Necropsia","review":null},
    {"code":"OFR-CUR-00007","course_code":"CUR-00007","name":"Eletricista Predial ou Refrigeração","review":"BUSINESS_REVIEW_REQUIRED"},
    {"code":"OFR-CUR-00008","course_code":"CUR-00008","name":"Massoterapia","review":null},
    {"code":"OFR-CUR-00010","course_code":"CUR-00010","name":"Frentista NR-20","review":null},
    {"code":"OFR-CUR-00011","course_code":"CUR-00011","name":"Recepcionista de Clínicas","review":null}
  ]'::jsonb;
begin
  for r in select * from jsonb_to_recordset(v_offers) as x(code text, course_code text, name text, review text) loop
    select c.id into v_course from public.courses c where c.code=r.course_code and c.status='ACTIVE';
    if v_course is null then raise exception 'Official active course not found: %', r.course_code; end if;
    select * into v_offer from public.course_offers where code=r.code;
    if found then
      if v_offer.name is distinct from r.name or v_offer.course_id is distinct from v_course or v_offer.offer_type <> 'COURSE' or v_offer.status <> 'DRAFT' or v_offer.valid_from <> v_valid_from or v_offer.valid_until is not null then
        raise exception 'Divergent existing offer code: %', r.code;
      end if;
      raise notice 'Existing identical offer skipped: %', r.code;
    else
      insert into public.course_offers(code,name,course_id,offer_type,status,valid_from,created_by,updated_by)
      values (r.code,r.name,v_course,'COURSE','DRAFT',v_valid_from,null,null);
      raise notice 'Created DRAFT offer: %', r.code;
    end if;
    if r.review is not null then raise notice '%: %', r.review, r.course_code; end if;
  end loop;

  select * into v_offer from public.course_offers where code='OFR-ONLINE-CATALOG';
  if found then
    if v_offer.name <> 'Catálogo de Cursos Online' or v_offer.course_id is not null or v_offer.offer_type <> 'ONLINE_CATALOG' or v_offer.status <> 'DRAFT' or v_offer.valid_from <> v_valid_from or v_offer.valid_until is not null then raise exception 'Divergent existing online catalog offer'; end if;
    raise notice 'Existing identical offer skipped: OFR-ONLINE-CATALOG';
  else
    insert into public.course_offers(code,name,course_id,offer_type,status,valid_from,created_by,updated_by)
    values ('OFR-ONLINE-CATALOG','Catálogo de Cursos Online',null,'ONLINE_CATALOG','DRAFT',v_valid_from,null,null);
    raise notice 'Created DRAFT offer: OFR-ONLINE-CATALOG';
  end if;
  raise notice 'DEFERRED_TO_BUNDLE_PHASE: CUR-00009 and PDF combos';
  raise notice 'DEFERRED_TO_SPECIAL_PRODUCTS_PHASE: technical EAD, certification, EJA, VIP and modules';
  raise notice 'LEGACY_COMMERCIAL_REVIEW_REQUIRED: PROF-0001, PROF-0002';
end;
$$;

do $$
declare
  v_offer_id uuid;
  v_course_id uuid;
  r record;
  v_items jsonb := '[
    {"course_code":"CUR-00012"},{"course_code":"CUR-00013"},{"course_code":"CUR-00014"},{"course_code":"CUR-00015"},{"course_code":"CUR-00016"},{"course_code":"CUR-00017"},{"course_code":"CUR-00018"},{"course_code":"CUR-00019"},{"course_code":"CUR-00020"},{"course_code":"CUR-00021"},{"course_code":"CUR-00022"},{"course_code":"CUR-00023"},{"course_code":"CUR-00024"},{"course_code":"CUR-00025"},{"course_code":"CUR-00026"},{"course_code":"CUR-00027"},{"course_code":"CUR-00028"},{"course_code":"CUR-00029"},{"course_code":"CUR-00030"},{"course_code":"CUR-00031"},{"course_code":"CUR-00032"},{"course_code":"CUR-00033"},{"course_code":"CUR-00034"},{"course_code":"CUR-00035"},{"course_code":"CUR-00036"},{"course_code":"CUR-00037"},{"course_code":"CUR-00038"},{"course_code":"CUR-00039"},{"course_code":"CUR-00040"},{"course_code":"CUR-00041"},{"course_code":"CUR-00042"},{"course_code":"CUR-00043"},{"course_code":"CUR-00044"},{"course_code":"CUR-00045"},{"course_code":"CUR-00046"},{"course_code":"CUR-00047"},{"course_code":"CUR-00048"},{"course_code":"CUR-00049"},{"course_code":"CUR-00050"},{"course_code":"CUR-00051"},{"course_code":"CUR-00052"},{"course_code":"CUR-00053"},{"course_code":"CUR-00054"},{"course_code":"CUR-00055"},{"course_code":"CUR-00056"},{"course_code":"CUR-00057"},{"course_code":"CUR-00058"},{"course_code":"CUR-00059"},{"course_code":"CUR-00060"},{"course_code":"CUR-00061"},{"course_code":"CUR-00062"},{"course_code":"CUR-00063"},{"course_code":"CUR-00064"},{"course_code":"CUR-00065"},{"course_code":"CUR-00066"}
  ]'::jsonb;
begin
  select id into v_offer_id from public.course_offers where code='OFR-ONLINE-CATALOG';
  if v_offer_id is null then raise exception 'Online catalog offer missing'; end if;
  for r in select * from jsonb_to_recordset(v_items) as x(course_code text) loop
    select id into v_course_id from public.courses where code=r.course_code and status='ACTIVE';
    if v_course_id is null then raise exception 'Online course missing: %', r.course_code; end if;
    if exists (select 1 from public.offer_items where offer_id=v_offer_id and course_id=v_course_id) then
      if not exists (select 1 from public.offer_items where offer_id=v_offer_id and course_id=v_course_id and selection_mode='SELECTABLE' and min_quantity is null and max_quantity is null and sort_order=0) then raise exception 'Divergent existing online item: %', r.course_code; end if;
      raise notice 'Existing identical online item skipped: %', r.course_code;
    else
      insert into public.offer_items(offer_id,course_id,selection_mode,min_quantity,max_quantity,sort_order)
      values (v_offer_id,v_course_id,'SELECTABLE',null,null,0);
      raise notice 'Created online SELECTABLE item: %', r.course_code;
    end if;
  end loop;
end;
$$;

create temporary table _commercial_seed_plans (
  code text primary key, offer_code text not null, payment_method text not null, pricing_model text not null,
  cash_price numeric(12,2), enrollment_fee numeric(12,2), installment_count integer, installment_amount numeric(12,2),
  total_amount numeric(12,2) not null, quantity_min integer, quantity_max integer
) on commit drop;

-- Regular courses: values copied from the PDF without interest calculations.
do $$
declare r record; c record;
  v_regular jsonb := '[
    {"offer":"OFR-CUR-00001","cash":2000,"boleto_count":12,"boleto_amount":220,"card":[2058,1039,699,529,427,360,311,275,246,224,206,190]},
    {"offer":"OFR-CUR-00002","cash":1800,"boleto_count":10,"boleto_amount":220,"card":[1852,936,629,476,385,324,280,247,222,202,185,171]},
    {"offer":"OFR-CUR-00003","cash":1300,"boleto_count":9,"boleto_amount":190,"card":[1338,676,455,344,278,234,202,179,160,146,134,124]},
    {"offer":"OFR-CUR-00004","cash":1500,"boleto_count":12,"boleto_amount":170,"card":[1552,789,530,400,323,272,235,208,186,169,155,143]},
    {"offer":"OFR-CUR-00005","cash":1300,"boleto_count":7,"boleto_amount":220,"card":[1338,676,455,344,278,234,202,179,160,146,134,124]},
    {"offer":"OFR-CUR-00006","cash":1500,"boleto_count":12,"boleto_amount":170,"card":[1552,789,530,400,323,272,235,208,186,169,155,143]},
    {"offer":"OFR-CUR-00007","cash":1300,"boleto_count":7,"boleto_amount":220,"card":[1338,676,455,344,278,234,202,179,160,146,134,124]},
    {"offer":"OFR-CUR-00008","cash":1000,"boleto_count":7,"boleto_amount":180,"card":[1035,526,353,267,215,181,157,139,124,113,103,95]},
    {"offer":"OFR-CUR-00010","cash":200,"boleto_count":1,"boleto_amount":200,"card":[205,104,70,53,43,36]},
    {"offer":"OFR-CUR-00011","cash":200,"boleto_count":1,"boleto_amount":200,"card":[205,104,70,53,43,36]}
  ]'::jsonb;
begin
  for r in select * from jsonb_to_recordset(v_regular) as x(offer text,cash numeric,boleto_count integer,boleto_amount numeric,card jsonb) loop
    insert into pg_temp._commercial_seed_plans values (r.offer||'-CASH',r.offer,'OTHER','CASH',r.cash,null,null,null,r.cash,null,null);
    insert into pg_temp._commercial_seed_plans values (r.offer||'-BOLETO-'||r.boleto_count||'X',r.offer,'BOLETO','FIXED_INSTALLMENT',null,null,r.boleto_count,r.boleto_amount,r.boleto_count*r.boleto_amount,null,null);
    for c in select value::numeric as amount, ordinality::integer as installment_no from jsonb_array_elements_text(r.card) with ordinality loop
      insert into pg_temp._commercial_seed_plans values (r.offer||'-CARD-'||lpad(c.installment_no::text,2,'0'),r.offer,'CREDIT_CARD','EXPLICIT_CARD_INSTALLMENT',null,null,c.installment_no,c.amount,c.installment_no*c.amount,null,null);
    end loop;
  end loop;
end;
$$;

-- ONLINE catalog: five à-vista tiers and the explicit 3x/5x card values.
do $$
declare r record; c record;
  v_online jsonb := '[
    {"qty":1,"cash":199,"card":{"3":71,"5":43}},
    {"qty":2,"cash":289,"card":{"3":102,"5":63}},
    {"qty":3,"cash":369,"card":{"3":131,"5":80}},
    {"qty":4,"cash":449,"card":{"3":157,"5":96}},
    {"qty":5,"cash":499,"card":{"3":175,"5":107}}
  ]'::jsonb;
begin
  for r in select * from jsonb_to_recordset(v_online) as x(qty integer,cash numeric,card jsonb) loop
    insert into pg_temp._commercial_seed_plans values ('OFR-ONLINE-CATALOG-QTY-'||r.qty||'-CASH','OFR-ONLINE-CATALOG','OTHER','QUANTITY_TIER',null,null,null,null,r.cash,r.qty,r.qty);
    for c in select key::integer as installment_no, value::numeric as amount from jsonb_each_text(r.card) loop
      insert into pg_temp._commercial_seed_plans values ('OFR-ONLINE-CATALOG-QTY-'||r.qty||'-CARD-'||c.installment_no||'X','OFR-ONLINE-CATALOG','CREDIT_CARD','EXPLICIT_CARD_INSTALLMENT',null,null,c.installment_no,c.amount,c.installment_no*c.amount,r.qty,r.qty);
    end loop;
  end loop;
end;
$$;

do $$
declare r record; v_offer_id uuid; v_existing public.price_plans%rowtype;
begin
  for r in select * from pg_temp._commercial_seed_plans order by code loop
    select id into v_offer_id from public.course_offers where code=r.offer_code;
    if v_offer_id is null then raise exception 'Offer missing for plan %: %', r.code, r.offer_code; end if;
    select * into v_existing from public.price_plans where code=r.code;
    if found then
      if v_existing.offer_id is distinct from v_offer_id or v_existing.payment_method is distinct from r.payment_method or v_existing.pricing_model is distinct from r.pricing_model or v_existing.cash_price is distinct from r.cash_price or v_existing.enrollment_fee is distinct from r.enrollment_fee or v_existing.installment_count is distinct from r.installment_count or v_existing.installment_amount is distinct from r.installment_amount or v_existing.total_amount is distinct from r.total_amount or v_existing.quantity_min is distinct from r.quantity_min or v_existing.quantity_max is distinct from r.quantity_max or v_existing.status <> 'DRAFT' or v_existing.valid_from <> '2026-04-01 00:00:00+00'::timestamptz or v_existing.valid_until is not null then
        raise exception 'Divergent existing price plan code: %', r.code;
      end if;
      raise notice 'Existing identical price plan skipped: %', r.code;
    else
      insert into public.price_plans(code,offer_id,payment_method,pricing_model,cash_price,enrollment_fee,installment_count,installment_amount,total_amount,quantity_min,quantity_max,status,valid_from,created_by,updated_by)
      values (r.code,v_offer_id,r.payment_method,r.pricing_model,r.cash_price,r.enrollment_fee,r.installment_count,r.installment_amount,r.total_amount,r.quantity_min,r.quantity_max,'DRAFT','2026-04-01 00:00:00+00'::timestamptz,null,null);
      raise notice 'Created DRAFT price plan: %', r.code;
    end if;
  end loop;
end;
$$;

commit;
