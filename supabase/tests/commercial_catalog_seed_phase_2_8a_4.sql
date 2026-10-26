-- FASE 2.8A.4 — smoke read-only da carga comercial.
-- Executar somente após aprovação/aplicação da migration de carga.
-- Não cria, altera ou remove dados.

do $$
declare
  r record;
  c record;
  v_offer_id uuid;
  v_course_id uuid;
  v_plan public.price_plans%rowtype;
  v_regular jsonb := '[
    {"offer":"OFR-CUR-00001","course_code":"CUR-00001","cash":2000,"boleto_count":12,"boleto_amount":220,"card":[2058,1039,699,529,427,360,311,275,246,224,206,190]},
    {"offer":"OFR-CUR-00002","course_code":"CUR-00002","cash":1800,"boleto_count":10,"boleto_amount":220,"card":[1852,936,629,476,385,324,280,247,222,202,185,171]},
    {"offer":"OFR-CUR-00003","course_code":"CUR-00003","cash":1300,"boleto_count":9,"boleto_amount":190,"card":[1338,676,455,344,278,234,202,179,160,146,134,124]},
    {"offer":"OFR-CUR-00004","course_code":"CUR-00004","cash":1500,"boleto_count":12,"boleto_amount":170,"card":[1552,789,530,400,323,272,235,208,186,169,155,143]},
    {"offer":"OFR-CUR-00005","course_code":"CUR-00005","cash":1300,"boleto_count":7,"boleto_amount":220,"card":[1338,676,455,344,278,234,202,179,160,146,134,124]},
    {"offer":"OFR-CUR-00006","course_code":"CUR-00006","cash":1500,"boleto_count":12,"boleto_amount":170,"card":[1552,789,530,400,323,272,235,208,186,169,155,143]},
    {"offer":"OFR-CUR-00007","course_code":"CUR-00007","cash":1300,"boleto_count":7,"boleto_amount":220,"card":[1338,676,455,344,278,234,202,179,160,146,134,124]},
    {"offer":"OFR-CUR-00008","course_code":"CUR-00008","cash":1000,"boleto_count":7,"boleto_amount":180,"card":[1035,526,353,267,215,181,157,139,124,113,103,95]},
    {"offer":"OFR-CUR-00010","course_code":"CUR-00010","cash":200,"boleto_count":1,"boleto_amount":200,"card":[205,104,70,53,43,36]},
    {"offer":"OFR-CUR-00011","course_code":"CUR-00011","cash":200,"boleto_count":1,"boleto_amount":200,"card":[205,104,70,53,43,36]}
  ]'::jsonb;
  v_online jsonb := '[
    {"qty":1,"cash":199,"card":{"3":71,"5":43}},
    {"qty":2,"cash":289,"card":{"3":102,"5":63}},
    {"qty":3,"cash":369,"card":{"3":131,"5":80}},
    {"qty":4,"cash":449,"card":{"3":157,"5":96}},
    {"qty":5,"cash":499,"card":{"3":175,"5":107}}
  ]'::jsonb;
begin
  -- Exact offer set: 10 regular + one online catalog, all DRAFT.
  if (select count(*) from public.course_offers) <> 11 then raise exception 'Expected 11 commercial offers'; end if;
  if (select count(*) from public.course_offers where offer_type='COURSE') <> 10 then raise exception 'Expected 10 regular COURSE offers'; end if;
  if (select count(*) from public.course_offers where status='ACTIVE') <> 0 then raise exception 'Seed offers must not be ACTIVE'; end if;
  if (select count(*) from public.course_offers where status<>'DRAFT' or valid_from<>'2026-04-01 00:00:00+00'::timestamptz or valid_until is not null) <> 0 then raise exception 'Seed offer status/validity mismatch'; end if;
  if (select count(*) from public.course_offers where code='OFR-ONLINE-CATALOG' and offer_type='ONLINE_CATALOG' and course_id is null and status='DRAFT') <> 1 then raise exception 'Online catalog offer mismatch'; end if;
  if exists (select 1 from public.course_offers where code='OFR-CUR-00009') then raise exception 'CUR-00009 must be absent'; end if;
  if exists (select 1 from public.course_offers o join public.courses c on c.id=o.course_id where c.code in ('PROF-0001','PROF-0002')) then raise exception 'Legacy courses must have no offers'; end if;
  if not exists (select 1 from public.course_offers where code='OFR-CUR-00007' and status='DRAFT') then raise exception 'CUR-00007 must remain DRAFT'; end if;

  -- Every regular offer and every regular plan is checked against the PDF data.
  for r in select * from jsonb_to_recordset(v_regular) as x(offer text,course_code text,cash numeric,boleto_count integer,boleto_amount numeric,card jsonb) loop
    select id into v_offer_id from public.course_offers where code=r.offer and offer_type='COURSE' and status='DRAFT';
    if v_offer_id is null then raise exception 'Missing regular offer: %', r.offer; end if;
    select id into v_course_id from public.courses where code=r.course_code;
    if not exists (select 1 from public.course_offers where id=v_offer_id and course_id=v_course_id) then raise exception 'Offer/course mismatch: %', r.offer; end if;

    select * into v_plan from public.price_plans where code=r.offer||'-CASH';
    if not found or v_plan.payment_method<>'OTHER' or v_plan.pricing_model<>'CASH' or v_plan.cash_price is distinct from r.cash or v_plan.total_amount is distinct from r.cash or v_plan.status<>'DRAFT' then raise exception 'Cash plan mismatch: %', r.offer; end if;
    select * into v_plan from public.price_plans where code=r.offer||'-BOLETO-'||r.boleto_count||'X';
    if not found or v_plan.payment_method<>'BOLETO' or v_plan.pricing_model<>'FIXED_INSTALLMENT' or v_plan.installment_count<>r.boleto_count or v_plan.installment_amount is distinct from r.boleto_amount or v_plan.total_amount is distinct from r.boleto_count*r.boleto_amount or v_plan.status<>'DRAFT' then raise exception 'Boleto plan mismatch: %', r.offer; end if;

    for c in select value::numeric as amount, ordinality::integer as installment_no from jsonb_array_elements_text(r.card) with ordinality loop
      select * into v_plan from public.price_plans where code=r.offer||'-CARD-'||lpad(c.installment_no::text,2,'0');
      if not found or v_plan.payment_method<>'CREDIT_CARD' or v_plan.pricing_model<>'EXPLICIT_CARD_INSTALLMENT' or v_plan.installment_count<>c.installment_no or v_plan.installment_amount is distinct from c.amount or v_plan.total_amount is distinct from c.installment_no*c.amount or v_plan.quantity_min is not null or v_plan.quantity_max is not null or v_plan.status<>'DRAFT' then raise exception 'Card plan mismatch: % installment %', r.offer, c.installment_no; end if;
    end loop;
    if (select count(*) from public.price_plans where offer_id=v_offer_id) <> 14 and r.offer not in ('OFR-CUR-00010','OFR-CUR-00011') then raise exception 'Expected 14 plans for %', r.offer; end if;
    if (select count(*) from public.price_plans where offer_id=v_offer_id) <> 8 and r.offer in ('OFR-CUR-00010','OFR-CUR-00011') then raise exception 'Expected 8 plans for %', r.offer; end if;
  end loop;

  -- Exact online item set: CUR-00012..CUR-00066, selectable and unique.
  select id into v_offer_id from public.course_offers where code='OFR-ONLINE-CATALOG';
  if (select count(*) from public.offer_items where offer_id=v_offer_id) <> 55 or (select count(distinct course_id) from public.offer_items where offer_id=v_offer_id) <> 55 then raise exception 'Online item cardinality mismatch'; end if;
  if exists (select 1 from public.offer_items oi join public.courses c on c.id=oi.course_id where oi.offer_id=v_offer_id and (c.code not between 'CUR-00012' and 'CUR-00066' or oi.selection_mode<>'SELECTABLE')) then raise exception 'Online item content mismatch'; end if;
  if exists (select 1 from public.offer_items oi join public.courses c on c.id=oi.course_id where oi.offer_id=v_offer_id and c.code between 'CUR-00001' and 'CUR-00011') then raise exception 'Regular course included in online catalog'; end if;

  -- Exact online quantity and card tiers.
  for r in select * from jsonb_to_recordset(v_online) as x(qty integer,cash numeric,card jsonb) loop
    select * into v_plan from public.price_plans where code='OFR-ONLINE-CATALOG-QTY-'||r.qty||'-CASH';
    if not found or v_plan.pricing_model<>'QUANTITY_TIER' or v_plan.payment_method<>'OTHER' or v_plan.quantity_min<>r.qty or v_plan.quantity_max<>r.qty or v_plan.total_amount is distinct from r.cash or v_plan.status<>'DRAFT' then raise exception 'Online cash tier mismatch: %', r.qty; end if;
    for c in select key::integer as installment_no, value::numeric as amount from jsonb_each_text(r.card) loop
      select * into v_plan from public.price_plans where code='OFR-ONLINE-CATALOG-QTY-'||r.qty||'-CARD-'||c.installment_no||'X';
      if not found or v_plan.pricing_model<>'EXPLICIT_CARD_INSTALLMENT' or v_plan.payment_method<>'CREDIT_CARD' or v_plan.quantity_min<>r.qty or v_plan.quantity_max<>r.qty or v_plan.installment_count<>c.installment_no or v_plan.installment_amount is distinct from c.amount or v_plan.total_amount is distinct from c.installment_no*c.amount or v_plan.status<>'DRAFT' then raise exception 'Online card tier mismatch: quantity %, installment %', r.qty, c.installment_no; end if;
    end loop;
  end loop;

  if (select count(*) from public.price_plans) <> 143 then raise exception 'Expected 143 price plans'; end if;
  if (select count(*) from public.price_plans p join public.course_offers o on o.id=p.offer_id where o.offer_type='COURSE') <> 128 then raise exception 'Expected 128 regular plans'; end if;
  if (select count(*) from public.price_plans where offer_id=v_offer_id) <> 15 then raise exception 'Expected 15 online plans'; end if;
  if (select count(*) from public.price_plans where status='ACTIVE') <> 0 then raise exception 'Seed plans must not be ACTIVE'; end if;
  if (select count(*) from public.price_plans where valid_from<>'2026-04-01 00:00:00+00'::timestamptz or valid_until is not null) <> 0 then raise exception 'Seed plan validity mismatch'; end if;
  if (select count(*) from public.price_plan_installments) <> 0 then raise exception 'Installment detail rows must remain empty'; end if;
  if exists (select 1 from public.course_offers where name ilike any(array['%combo%','%pacote%','%técnico%','%certificação%','%EJA%','%VIP%','%módulo%'])) then raise exception 'Deferred products or combos were seeded'; end if;
  if exists (select 1 from public.courses where code between 'CUR-00001' and 'CUR-00066' and default_price is not null) then raise exception 'default_price unexpectedly populated'; end if;
end;
$$;
