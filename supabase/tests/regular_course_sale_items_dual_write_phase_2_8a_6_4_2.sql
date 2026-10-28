-- FASE 2.8A.6.4.2 — REGULAR COURSE SALE_ITEMS DUAL-WRITE SMOKE
-- All fixtures and mutations are contained in one transaction and rolled back.
begin;

do $$
declare
  v_fn oid;
  v_definition text;
  v_actor uuid;
  v_lead_id uuid;
  v_failure_lead_id uuid;
  v_offer_id uuid;
  v_online_offer_id uuid;
  v_invalid_offer_id uuid;
  v_failure_offer_id uuid;
  v_plan_id uuid;
  v_wrong_plan_id uuid;
  v_failure_plan_id uuid;
  v_failure_course_interest_id uuid;
  v_course_id uuid;
  v_sale_id uuid;
  v_sale_item_id uuid;
  v_failure_person_id uuid;
  v_positive_person_id uuid;
  v_before_lead_status text;
  v_before_student_count integer;
  v_before_pending_count integer;
  v_before_sale_count integer;
  v_before_item_count integer;
  v_before_positive_student_count integer;
  v_before_audit_sales_count integer;
  v_before_audit_lead_count integer;
  v_before_contract_count integer;
  v_before_enrollment_count integer;
  v_before_name text;
  v_before_code text;
  v_before_workload integer;
  v_before_modality text;
  v_sale json;
  v_detail jsonb;
  v_list json;
  v_error boolean;
  v_audit_count integer;
begin
  select p.oid, pg_get_functiondef(p.oid)
    into v_fn, v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_sale_from_commercial_offer'
    and pg_get_function_identity_arguments(p.oid) = 'p_lead_id uuid, p_offer_id uuid, p_price_plan_id uuid, p_discount_value numeric, p_commercial_notes text';
  if v_fn is null then raise exception 'Commercial sale RPC signature missing'; end if;
  if lower(v_definition) not like '%security definer%'
     or not exists (select 1 from pg_proc where oid=v_fn and 'search_path=pg_catalog, public' = any(proconfig))
     or not exists (select 1 from pg_proc where oid=v_fn and 'row_security=off' = any(proconfig)) then
    raise exception 'Commercial sale RPC security contract changed';
  end if;
  if lower(v_definition) not like '%insert into public.sale_items%'
     or lower(v_definition) not like '%v_sale_item_id%'
     or lower(v_definition) not like '%item_count%'
     or lower(v_definition) not like '%sale_item_id%' then
    raise exception 'Sale Item dual-write or audit metadata missing';
  end if;
  if has_function_privilege('anon', v_fn, 'EXECUTE')
     or has_function_privilege('public', v_fn, 'EXECUTE')
     or not has_function_privilege('authenticated', v_fn, 'EXECUTE') then
    raise exception 'Commercial sale RPC grants are incorrect';
  end if;
  if has_function_privilege('authenticated', 'public.create_sale_from_lead(uuid,uuid,numeric,text,numeric,integer,text)', 'EXECUTE') then
    raise exception 'Legacy sale RPC must remain disabled';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public'
        and p.proname ~ '(create|add|update|delete).*sale_item|sale_item.*(create|add|update|delete)') <> 0 then
    raise exception 'Dedicated Sale Item write RPC exists';
  end if;

  if (select count(*) from public.sales) <> 15 then raise exception 'Historical sales count changed'; end if;
  if (select count(*) from public.sale_items) <> 0 then raise exception 'Historical Sale Items were backfilled'; end if;
  select count(*) into v_before_contract_count from public.contracts;
  select count(*) into v_before_enrollment_count from public.enrollments;
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='sales' and column_name='course_id') <> 'NO' then
    raise exception 'sales.course_id must remain NOT NULL';
  end if;
  if not exists (select 1 from pg_class where oid='public.sales'::regclass and relrowsecurity)
     or not exists (select 1 from pg_class where oid='public.sale_items'::regclass and relrowsecurity) then
    raise exception 'Sales/Sale Items RLS must remain enabled';
  end if;
  if has_table_privilege('authenticated','public.sale_items','INSERT')
     or has_table_privilege('authenticated','public.sale_items','UPDATE')
     or has_table_privilege('authenticated','public.sale_items','DELETE') then
    raise exception 'Sale Items must remain RPC-only';
  end if;

  select ur.user_id into v_actor
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id=ur.role_id
  join public.permissions p on p.id=rp.permission_id
  where p.code in ('sales.create','sales.view','sales.view_all','crm.view_all')
  group by ur.user_id
  having count(distinct p.code)=4
  order by ur.user_id
  limit 1;
  if v_actor is null then raise exception 'No full-permission smoke actor found'; end if;
  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select l.id, o.id, pp.id, c.id
    into v_lead_id, v_offer_id, v_plan_id, v_course_id
  from public.crm_leads l
  join public.crm_pipeline_stages st on st.id=l.stage_id
  join public.course_offers o on o.course_id is not null and o.offer_type='COURSE'
  join public.price_plans pp on pp.offer_id=o.id
  join public.courses c on c.id=o.course_id
  where l.status='OPEN'
    and st.code in ('PROPOSAL_SENT','NEGOTIATION')
    and (l.course_interest_id is null or l.course_interest_id=o.course_id)
    and o.status='ACTIVE' and o.valid_from <= now() and (o.valid_until is null or o.valid_until > now())
    and pp.status='ACTIVE' and pp.valid_from <= now() and (pp.valid_until is null or pp.valid_until > now())
    and pp.quantity_min is null and pp.quantity_max is null
    and c.status='ACTIVE'
    and not exists (select 1 from public.sales s where s.lead_id=l.id)
  order by l.created_at
  limit 1;
  if v_lead_id is null then raise exception 'No valid regular COURSE lead fixture found'; end if;

  select l.id, l.course_interest_id, o.id, pp.id
    into v_failure_lead_id, v_failure_course_interest_id, v_failure_offer_id, v_failure_plan_id
  from public.crm_leads l
  join public.crm_pipeline_stages st on st.id=l.stage_id
  join public.course_offers o on o.course_id is not null and o.offer_type='COURSE'
  join public.price_plans pp on pp.offer_id=o.id
  join public.courses c on c.id=o.course_id
  where l.id <> v_lead_id
    and l.status='OPEN' and st.code in ('PROPOSAL_SENT','NEGOTIATION')
    and (l.course_interest_id is null or l.course_interest_id=o.course_id)
    and o.status='ACTIVE' and o.valid_from <= now() and (o.valid_until is null or o.valid_until > now())
    and pp.status='ACTIVE' and pp.valid_from <= now() and (pp.valid_until is null or pp.valid_until > now())
    and pp.quantity_min is null and pp.quantity_max is null
    and c.status='ACTIVE'
    and not exists (select 1 from public.sales s where s.lead_id=l.id)
  order by l.created_at
  limit 1;
  if v_failure_lead_id is null then raise exception 'No second regular COURSE lead fixture found'; end if;

  -- Positive path: one Sale and exactly one structural Sale Item.
  select person_id into v_positive_person_id from public.crm_leads where id=v_lead_id;
  select count(*) into v_before_positive_student_count from public.students where person_id=v_positive_person_id;
  v_sale := public.create_sale_from_commercial_offer(v_lead_id, v_offer_id, v_plan_id, 0, 'DUAL-WRITE SMOKE');
  v_sale_id := (v_sale->>'sale_id')::uuid;
  if (v_sale->>'sale_code') !~ '^VND-[0-9]{4}-[0-9]{6}$' then raise exception 'Sale code format changed'; end if;
  if (select status from public.crm_leads where id=v_lead_id) <> 'WON' then raise exception 'Lead was not marked WON after Sale Item creation'; end if;
  if exists (select 1 from public.crm_activities where lead_id=v_lead_id and status='PENDING') then raise exception 'Pending activities were not canceled'; end if;
  if (select count(*) from public.students where person_id=v_positive_person_id) not between v_before_positive_student_count and v_before_positive_student_count+1 then
    raise exception 'Student create/reuse behavior changed';
  end if;
  if (select count(*) from public.contracts) <> v_before_contract_count or (select count(*) from public.enrollments) <> v_before_enrollment_count then
    raise exception 'Contract/Enrollment flow was changed';
  end if;
  select id into v_sale_item_id from public.sale_items where sale_id=v_sale_id;
  if (select count(*) from public.sale_items where sale_id=v_sale_id) <> 1 then
    raise exception 'Regular COURSE Sale did not create exactly one Sale Item';
  end if;
  if (select position from public.sale_items where id=v_sale_item_id) <> 1 then raise exception 'Sale Item position is not 1'; end if;
  if (select offer_item_id from public.sale_items where id=v_sale_item_id) is not null then raise exception 'Regular Sale Item has an Offer Item'; end if;
  if (select created_by from public.sale_items where id=v_sale_item_id) <> v_actor then raise exception 'Sale Item created_by mismatch'; end if;
  if not exists (
    select 1 from public.sale_items si join public.sales s on s.id=si.sale_id
    where si.id=v_sale_item_id and si.course_id=s.course_id and si.course_id=v_course_id
      and si.course_name_snapshot=s.course_name_snapshot
      and si.course_workload_snapshot is not distinct from s.course_workload_snapshot
      and si.course_modality_snapshot is not distinct from s.course_modality_snapshot
      and si.course_code_snapshot=(select code from public.courses where id=v_course_id)
  ) then raise exception 'Sale and Sale Item snapshots are inconsistent'; end if;

  v_detail := public.get_sale_detail(v_sale_id)::jsonb;
  if (v_detail->>'item_count')::integer <> 1 or jsonb_array_length(v_detail->'items') <> 1 then raise exception 'Sale detail item payload mismatch'; end if;
  if (v_detail->'items'->0->>'position')::integer <> 1 or (v_detail->'items'->0->>'course_id')::uuid <> v_course_id then raise exception 'Sale detail item identity mismatch'; end if;
  v_list := public.list_sale_items(v_sale_id);
  if json_array_length(v_list) <> 1 or (v_list->0->>'position')::integer <> 1 then raise exception 'list_sale_items payload mismatch'; end if;
  v_list := public.list_sales(null,null,null,null,null,null,1,100);
  if not exists (select 1 from json_array_elements(v_list->'data') r where r->>'id'=v_sale_id::text and (r->>'item_count')::integer=1) then raise exception 'list_sales item_count mismatch'; end if;
  select count(*) into v_audit_count from public.audit_logs where action='sales.created' and entity_id=v_sale_id::text and metadata->>'item_count'='1' and metadata->>'sale_item_id'=v_sale_item_id::text;
  if v_audit_count <> 1 then raise exception 'sales.created audit metadata mismatch'; end if;
  if exists (select 1 from public.audit_logs where action='sales.item_created' and entity_id=v_sale_item_id::text) then
    raise exception 'Dedicated Sale Item audit event must not be emitted';
  end if;

  -- Snapshots remain historical after Course changes.
  select si.course_code_snapshot, si.course_name_snapshot, si.course_workload_snapshot, si.course_modality_snapshot
    into v_before_code, v_before_name, v_before_workload, v_before_modality
  from public.sale_items si where si.id=v_sale_item_id;
  update public.courses set code='SMK-'||substr(v_course_id::text,1,8), name='SMOKE MUTATED COURSE', workload_hours=121,
    modality=case when v_before_modality='ONLINE' then 'PRESENCIAL' else 'ONLINE' end
  where id=v_course_id;
  if (select course_code_snapshot from public.sale_items where id=v_sale_item_id) is distinct from v_before_code
     or (select course_name_snapshot from public.sale_items where id=v_sale_item_id) is distinct from v_before_name
     or (select course_workload_snapshot from public.sale_items where id=v_sale_item_id) is distinct from v_before_workload
     or (select course_modality_snapshot from public.sale_items where id=v_sale_item_id) is distinct from v_before_modality then
    raise exception 'Sale Item snapshots changed after Course mutation';
  end if;

  if (select course_code_snapshot from public.sales where id=v_sale_id) is distinct from v_before_code
     or (select course_name_snapshot from public.sales where id=v_sale_id) is distinct from v_before_name
     or (select course_workload_snapshot from public.sales where id=v_sale_id) is distinct from v_before_workload
     or (select course_modality_snapshot from public.sales where id=v_sale_id) is distinct from v_before_modality then
    raise exception 'Sale snapshots diverged from Sale Item snapshots';
  end if;

  -- Duplicate Sale remains rejected and cannot create an extra Item.
  v_error := false;
  begin perform public.create_sale_from_commercial_offer(v_lead_id,v_offer_id,v_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error or (select count(*) from public.sale_items where sale_id=v_sale_id) <> 1 then raise exception 'Duplicate Sale protection changed'; end if;

  -- Invalid offer, plan and discount inputs fail before any Sale/Item is created.
  select id into v_online_offer_id from public.course_offers where offer_type='ONLINE_CATALOG' limit 1;
  if v_online_offer_id is null then raise exception 'ONLINE_CATALOG smoke fixture missing'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_online_offer_id,v_failure_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'ONLINE_CATALOG offer was accepted'; end if;
  select pp.id into v_wrong_plan_id from public.price_plans pp where pp.offer_id<>v_offer_id and pp.status='ACTIVE' limit 1;
  if v_wrong_plan_id is null then raise exception 'Wrong-offer price plan smoke fixture missing'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_wrong_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Price plan from another Offer was accepted'; end if;
  select id into v_invalid_offer_id from public.course_offers where offer_type='COURSE' and status <> 'ACTIVE' limit 1;
  if v_invalid_offer_id is null then raise exception 'Inactive COURSE offer smoke fixture missing'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_invalid_offer_id,v_failure_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Inactive COURSE offer was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_failure_offer_id,v_failure_plan_id,-1,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Negative discount was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_failure_offer_id,v_failure_plan_id,'NaN'::numeric,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'NaN discount was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_failure_offer_id,v_failure_plan_id,'Infinity'::numeric,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Infinity discount was accepted'; end if;
  v_error := false;
  begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_failure_offer_id,v_failure_plan_id,
    (select total_amount from public.price_plans where id=v_failure_plan_id)+1,null);
  exception when others then v_error := true; end;
  if not v_error then raise exception 'Discount above gross was accepted'; end if;

  update public.crm_leads
  set course_interest_id=(select c.id from public.courses c where c.id <> (select course_id from public.course_offers where id=v_failure_offer_id) and c.status='ACTIVE' limit 1)
  where id=v_failure_lead_id;
  v_error := false;
  begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_failure_offer_id,v_failure_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Lead/course mismatch was accepted'; end if;
  update public.crm_leads set course_interest_id=v_failure_course_interest_id where id=v_failure_lead_id;

  -- Controlled Sale Item failure proves the Sale/Student/Lead/Activity transaction is atomic.
  select l.person_id, l.status, (select count(*) from public.students st where st.person_id=l.person_id),
    (select count(*) from public.crm_activities a where a.lead_id=l.id and a.status='PENDING'),
    (select count(*) from public.sales s where s.lead_id=l.id), (select count(*) from public.sale_items si join public.sales s on s.id=si.sale_id where s.lead_id=l.id),
    (select count(*) from public.audit_logs where action='sales.created'), (select count(*) from public.audit_logs where action='crm.lead_won')
    into v_failure_person_id, v_before_lead_status, v_before_student_count, v_before_pending_count, v_before_sale_count, v_before_item_count, v_before_audit_sales_count, v_before_audit_lead_count
  from public.crm_leads l where l.id=v_failure_lead_id;
  create function pg_temp.reject_sale_item_smoke() returns trigger language plpgsql as $fn$
  begin raise exception 'controlled Sale Item failure'; end;
  $fn$;
  create trigger sale_items_smoke_reject before insert on public.sale_items
    for each row execute function pg_temp.reject_sale_item_smoke();
  v_error := false;
  begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_failure_offer_id,v_failure_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Controlled Sale Item failure was not raised'; end if;
  if (select count(*) from public.sales where lead_id=v_failure_lead_id) <> v_before_sale_count
     or (select count(*) from public.sale_items si join public.sales s on s.id=si.sale_id where s.lead_id=v_failure_lead_id) <> v_before_item_count
     or (select status from public.crm_leads where id=v_failure_lead_id) <> v_before_lead_status
     or (select count(*) from public.students where person_id=v_failure_person_id) <> v_before_student_count
     or (select count(*) from public.crm_activities where lead_id=v_failure_lead_id and status='PENDING') <> v_before_pending_count
     or (select count(*) from public.audit_logs where action='sales.created') <> v_before_audit_sales_count
     or (select count(*) from public.audit_logs where action='crm.lead_won') <> v_before_audit_lead_count then
    raise exception 'Sale Item failure was not atomic';
  end if;

  -- A failure in audit must also roll back the Sale Item, Sale, Student and Lead changes.
  drop trigger sale_items_smoke_reject on public.sale_items;
  create function pg_temp.reject_audit_smoke() returns trigger language plpgsql as $fn$
  begin raise exception 'controlled audit failure'; end;
  $fn$;
  create trigger audit_logs_smoke_reject before insert on public.audit_logs
    for each row execute function pg_temp.reject_audit_smoke();
  select l.person_id, l.status, (select count(*) from public.students st where st.person_id=l.person_id),
    (select count(*) from public.crm_activities a where a.lead_id=l.id and a.status='PENDING'),
    (select count(*) from public.sales s where s.lead_id=l.id), (select count(*) from public.sale_items si join public.sales s on s.id=si.sale_id where s.lead_id=l.id),
    (select count(*) from public.audit_logs where action='sales.created'), (select count(*) from public.audit_logs where action='crm.lead_won')
    into v_failure_person_id, v_before_lead_status, v_before_student_count, v_before_pending_count, v_before_sale_count, v_before_item_count, v_before_audit_sales_count, v_before_audit_lead_count
  from public.crm_leads l where l.id=v_failure_lead_id;
  v_error := false;
  begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_failure_offer_id,v_failure_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Controlled audit failure was not raised'; end if;
  if (select count(*) from public.sales where lead_id=v_failure_lead_id) <> v_before_sale_count
     or (select count(*) from public.sale_items si join public.sales s on s.id=si.sale_id where s.lead_id=v_failure_lead_id) <> v_before_item_count
     or (select status from public.crm_leads where id=v_failure_lead_id) <> v_before_lead_status
     or (select count(*) from public.students where person_id=v_failure_person_id) <> v_before_student_count
     or (select count(*) from public.crm_activities where lead_id=v_failure_lead_id and status='PENDING') <> v_before_pending_count
     or (select count(*) from public.audit_logs where action='sales.created') <> v_before_audit_sales_count
     or (select count(*) from public.audit_logs where action='crm.lead_won') <> v_before_audit_lead_count then
    raise exception 'Audit failure was not atomic';
  end if;

  raise notice 'regular COURSE Sale Items dual-write smoke passed';
end;
$$;

rollback;
