-- FASE 2.8A.6.4.2 — REGULAR COURSE SALE_ITEMS DUAL-WRITE SMOKE
-- Catalog rows are read-only references. All fixture and business mutations are
-- contained in this transaction and are removed by the final ROLLBACK.
begin;

do $$
declare
  v_fn oid;
  v_definition text;
  v_actor uuid;
  v_stage_id uuid;
  v_source_id uuid;
  v_lead_id uuid;
  v_reuse_lead_id uuid;
  v_failure_lead_id uuid;
  v_mismatch_lead_id uuid;
  v_person_id uuid;
  v_reuse_person_id uuid;
  v_failure_person_id uuid;
  v_mismatch_person_id uuid;
  v_offer_id uuid;
  v_plan_id uuid;
  v_wrong_plan_id uuid;
  v_online_offer_id uuid;
  v_course_id uuid;
  v_mismatch_course_id uuid;
  v_sale_id uuid;
  v_reuse_sale_id uuid;
  v_sale_item_id uuid;
  v_reuse_student_id uuid;
  v_before_reuse_student_count integer;
  v_before_failure_status text;
  v_before_failure_student_count integer;
  v_before_failure_pending_count integer;
  v_before_failure_sale_count integer;
  v_before_failure_item_count integer;
  v_before_failure_audit_count integer;
  v_before_code text;
  v_before_name text;
  v_before_workload integer;
  v_before_modality text;
  v_before_sales bigint;
  v_before_sale_items bigint;
  v_before_contracts bigint;
  v_before_enrollments bigint;
  v_before_courses bigint;
  v_before_positive_audit_count integer;
  v_audit_count integer;
  v_detail jsonb;
  v_list json;
  v_sale json;
  v_error boolean;
begin
  select p.oid, pg_get_functiondef(p.oid)
    into v_fn, v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_sale_from_commercial_offer'
    and pg_get_function_identity_arguments(p.oid) =
      'p_lead_id uuid, p_offer_id uuid, p_price_plan_id uuid, p_discount_value numeric, p_commercial_notes text';
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

  select count(*) into v_before_sales from public.sales;
  select count(*) into v_before_sale_items from public.sale_items;
  select count(*) into v_before_contracts from public.contracts;
  select count(*) into v_before_enrollments from public.enrollments;
  select count(*) into v_before_courses from public.courses;
  if v_before_sales <> 15 or v_before_sale_items <> 0 or v_before_contracts <> 12
     or v_before_enrollments <> 6 or v_before_courses <> 68 then
    raise exception 'Unexpected Production baseline: sales %, items %, contracts %, enrollments %, courses %',
      v_before_sales, v_before_sale_items, v_before_contracts, v_before_enrollments, v_before_courses;
  end if;
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
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);

  -- Deterministic real catalog references; no catalog row is changed permanently.
  select o.id, p.id, o.course_id
    into v_offer_id, v_plan_id, v_course_id
  from public.course_offers o
  join public.price_plans p on p.offer_id=o.id
  join public.courses c on c.id=o.course_id
  where o.status='ACTIVE' and o.offer_type='COURSE' and o.course_id is not null
    and o.valid_from <= now() and (o.valid_until is null or o.valid_until >= now())
    and p.status='ACTIVE' and p.valid_from <= now() and (p.valid_until is null or p.valid_until >= now())
    and p.quantity_min is null and p.quantity_max is null and c.status='ACTIVE'
  order by o.code, o.id, p.code, p.id
  limit 1;
  if v_offer_id is null then raise exception 'No active regular COURSE catalog fixture found'; end if;
  select c.id into v_mismatch_course_id from public.courses c
    where c.status='ACTIVE' and c.id <> v_course_id order by c.code, c.id limit 1;
  if v_mismatch_course_id is null then raise exception 'No second ACTIVE Course available for mismatch fixture'; end if;
  select p.id into v_wrong_plan_id from public.price_plans p
    where p.offer_id <> v_offer_id and p.status='ACTIVE' order by p.code, p.id limit 1;
  if v_wrong_plan_id is null then raise exception 'No active Plan from another Offer available'; end if;
  select id into v_online_offer_id from public.course_offers
    where code='OFR-ONLINE-CATALOG' or offer_type='ONLINE_CATALOG' order by code, id limit 1;
  if v_online_offer_id is null then raise exception 'ONLINE_CATALOG smoke fixture missing'; end if;

  select id into v_stage_id from public.crm_pipeline_stages where code='NEGOTIATION';
  select id into v_source_id from public.crm_lead_sources where code='OUTRO';
  if v_stage_id is null or v_source_id is null then raise exception 'CRM fixture lookup failed'; end if;

  -- Four synthetic identities and Leads. None existed before this transaction.
  insert into public.people(full_name, created_by, updated_by)
    values ('SMOKE DUAL WRITE POSITIVE', v_actor, v_actor) returning id into v_person_id;
  insert into public.crm_leads(lead_code, person_id, stage_id, source_id, course_interest_id, owner_user_id, status, temperature, created_by, updated_by)
    values ('SMOKE-DW-POS-'||substr(gen_random_uuid()::text,1,8), v_person_id, v_stage_id, v_source_id, v_course_id, v_actor, 'OPEN', 'HOT', v_actor, v_actor)
    returning id into v_lead_id;
  insert into public.crm_activities(lead_id, owner_user_id, type, title, due_at, created_by, updated_by)
    values (v_lead_id, v_actor, 'CALL', 'SMOKE dual-write activity', now()+interval '1 day', v_actor, v_actor);

  insert into public.people(full_name, created_by, updated_by)
    values ('SMOKE DUAL WRITE STUDENT REUSE', v_actor, v_actor) returning id into v_reuse_person_id;
  insert into public.students(person_id, student_code, status, registration_date, created_by, updated_by)
    values (v_reuse_person_id, 'ALU-SMOKE-'||substr(gen_random_uuid()::text,1,8), 'PRE_CADASTRO', current_date, v_actor, v_actor)
    returning id into v_reuse_student_id;
  insert into public.crm_leads(lead_code, person_id, stage_id, source_id, course_interest_id, owner_user_id, status, temperature, created_by, updated_by)
    values ('SMOKE-DW-REU-'||substr(gen_random_uuid()::text,1,8), v_reuse_person_id, v_stage_id, v_source_id, v_course_id, v_actor, 'OPEN', 'WARM', v_actor, v_actor)
    returning id into v_reuse_lead_id;

  insert into public.people(full_name, created_by, updated_by)
    values ('SMOKE DUAL WRITE FAILURE', v_actor, v_actor) returning id into v_failure_person_id;
  insert into public.crm_leads(lead_code, person_id, stage_id, source_id, course_interest_id, owner_user_id, status, temperature, created_by, updated_by)
    values ('SMOKE-DW-FAIL-'||substr(gen_random_uuid()::text,1,8), v_failure_person_id, v_stage_id, v_source_id, v_course_id, v_actor, 'OPEN', 'COLD', v_actor, v_actor)
    returning id into v_failure_lead_id;
  insert into public.crm_activities(lead_id, owner_user_id, type, title, due_at, created_by, updated_by)
    values (v_failure_lead_id, v_actor, 'FOLLOW_UP', 'SMOKE failure activity', now()+interval '1 day', v_actor, v_actor);

  insert into public.people(full_name, created_by, updated_by)
    values ('SMOKE DUAL WRITE MISMATCH', v_actor, v_actor) returning id into v_mismatch_person_id;
  insert into public.crm_leads(lead_code, person_id, stage_id, source_id, course_interest_id, owner_user_id, status, temperature, created_by, updated_by)
    values ('SMOKE-DW-MIS-'||substr(gen_random_uuid()::text,1,8), v_mismatch_person_id, v_stage_id, v_source_id, v_mismatch_course_id, v_actor, 'OPEN', 'COLD', v_actor, v_actor)
    returning id into v_mismatch_lead_id;

  -- Positive flow: the RPC creates the Student, Sale and exactly one Sale Item.
  select count(*) into v_before_positive_audit_count from public.audit_logs where action='sales.created';
  v_sale := public.create_sale_from_commercial_offer(v_lead_id, v_offer_id, v_plan_id, 0, 'DUAL-WRITE SMOKE');
  v_sale_id := (v_sale->>'sale_id')::uuid;
  if (v_sale->>'sale_code') !~ '^VND-[0-9]{4}-[0-9]{6}$' then raise exception 'Sale code format changed'; end if;
  if (select count(*) from public.sale_items where sale_id=v_sale_id) <> 1 then raise exception 'Exactly-one Sale Item invariant failed'; end if;
  select id into v_sale_item_id from public.sale_items where sale_id=v_sale_id;
  if (select position from public.sale_items where id=v_sale_item_id) <> 1 then raise exception 'Sale Item position is not 1'; end if;
  if (select course_id from public.sale_items where id=v_sale_item_id) <> v_course_id then raise exception 'Sale Item course mismatch'; end if;
  if (select offer_item_id from public.sale_items where id=v_sale_item_id) is not null then raise exception 'Regular Sale Item has an Offer Item'; end if;
  if (select created_by from public.sale_items where id=v_sale_item_id) <> v_actor then raise exception 'Sale Item created_by mismatch'; end if;
  if not exists (select 1 from public.sale_items si join public.sales s on s.id=si.sale_id
    where si.id=v_sale_item_id and si.course_id=s.course_id and si.course_id=v_course_id
      and si.course_name_snapshot=s.course_name_snapshot
      and si.course_workload_snapshot is not distinct from s.course_workload_snapshot
      and si.course_modality_snapshot is not distinct from s.course_modality_snapshot
      and si.course_code_snapshot=(select code from public.courses where id=v_course_id)) then
    raise exception 'Sale and Sale Item snapshots are inconsistent';
  end if;
  if (select status from public.crm_leads where id=v_lead_id) <> 'WON' then raise exception 'Lead was not marked WON'; end if;
  if exists (select 1 from public.crm_activities where lead_id=v_lead_id and status='PENDING') then raise exception 'Activity was not canceled'; end if;
  if (select count(*) from public.students where person_id=v_person_id) <> 1 then raise exception 'Student was not created'; end if;
  select count(*) into v_audit_count from public.audit_logs where action='sales.created' and entity_id=v_sale_id::text
    and metadata->>'item_count'='1' and metadata->>'sale_item_id'=v_sale_item_id::text;
  if v_audit_count <> 1 or (select count(*) from public.audit_logs where action='sales.created') <> v_before_positive_audit_count+1 then raise exception 'sales.created audit mismatch'; end if;
  if exists (select 1 from public.audit_logs where action='sales.item_created' and entity_id=v_sale_item_id::text) then raise exception 'Unexpected Sale Item audit event'; end if;

  v_detail := public.get_sale_detail(v_sale_id)::jsonb;
  if (v_detail->>'item_count')::integer <> 1 or jsonb_array_length(v_detail->'items') <> 1 then raise exception 'Sale detail item payload mismatch'; end if;
  v_list := public.list_sale_items(v_sale_id);
  if json_array_length(v_list) <> 1 then raise exception 'list_sale_items payload mismatch'; end if;
  v_list := public.list_sales(null,null,null,null,null,null,1,100);
  if not exists (select 1 from json_array_elements(v_list->'data') r where r->>'id'=v_sale_id::text and (r->>'item_count')::integer=1) then raise exception 'list_sales item_count mismatch'; end if;

  -- Independent valid flow with a pre-existing Student proves reuse/no duplication.
  v_before_reuse_student_count := (select count(*) from public.students where person_id=v_reuse_person_id);
  v_sale := public.create_sale_from_commercial_offer(v_reuse_lead_id, v_offer_id, v_plan_id, 0, 'DUAL-WRITE STUDENT REUSE');
  v_reuse_sale_id := (v_sale->>'sale_id')::uuid;
  if (select count(*) from public.students where person_id=v_reuse_person_id) <> v_before_reuse_student_count then raise exception 'Student was duplicated'; end if;
  if (select count(*) from public.sale_items where sale_id=v_reuse_sale_id) <> 1 then raise exception 'Student reuse Sale Item invariant failed'; end if;

  -- Snapshot immutability; restore the catalog row before negative scenarios.
  select code, name, workload_hours, modality into v_before_code, v_before_name, v_before_workload, v_before_modality from public.courses where id=v_course_id;
  update public.courses set code='SMK-'||substr(v_course_id::text,1,8), name='SMOKE MUTATED COURSE', workload_hours=121,
    modality=case when v_before_modality='ONLINE' then 'PRESENCIAL' else 'ONLINE' end where id=v_course_id;
  if (select course_name_snapshot from public.sales where id=v_sale_id) is distinct from v_before_name
     or (select course_workload_snapshot from public.sales where id=v_sale_id) is distinct from v_before_workload
     or (select course_modality_snapshot from public.sales where id=v_sale_id) is distinct from v_before_modality
     or (select course_code_snapshot from public.sale_items where id=v_sale_item_id) is distinct from v_before_code then
    raise exception 'Course snapshot immutability failed';
  end if;
  update public.courses set code=v_before_code, name=v_before_name, workload_hours=v_before_workload, modality=v_before_modality where id=v_course_id;

  -- Duplicate, invalid Offer/Plan/ONLINE, mismatch and discount validation.
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_lead_id,v_offer_id,v_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error or (select count(*) from public.sale_items where sale_id=v_sale_id) <> 1 then raise exception 'Duplicate Sale protection changed'; end if;
  update public.course_offers set status='DRAFT' where id=v_offer_id;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_plan_id,0,null); exception when others then v_error := true; end;
  update public.course_offers set status='ACTIVE' where id=v_offer_id;
  if not v_error then raise exception 'Inactive COURSE offer was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_online_offer_id,v_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'ONLINE_CATALOG offer was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_wrong_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Wrong-offer Plan was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_mismatch_lead_id,v_offer_id,v_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Lead/course mismatch was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_plan_id,-1,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Negative discount was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_plan_id,'NaN'::numeric,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'NaN discount was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_plan_id,'Infinity'::numeric,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Infinity discount was accepted'; end if;
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_plan_id,(select total_amount from public.price_plans where id=v_plan_id)+1,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Discount above gross was accepted'; end if;

  -- Sale Item failure: the trigger is created only inside this transaction.
  select status, (select count(*) from public.students where person_id=l.person_id),
    (select count(*) from public.crm_activities where lead_id=l.id and status='PENDING'),
    (select count(*) from public.sales where lead_id=l.id),
    (select count(*) from public.sale_items si join public.sales s on s.id=si.sale_id where s.lead_id=l.id),
    (select count(*) from public.audit_logs where action='sales.created')
    into v_before_failure_status, v_before_failure_student_count, v_before_failure_pending_count,
      v_before_failure_sale_count, v_before_failure_item_count, v_before_failure_audit_count
  from public.crm_leads l where l.id=v_failure_lead_id;
  create function pg_temp.reject_sale_item_smoke() returns trigger language plpgsql as $fn$ begin raise exception 'controlled Sale Item failure'; end; $fn$;
  create trigger sale_items_smoke_reject before insert on public.sale_items for each row execute function pg_temp.reject_sale_item_smoke();
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Controlled Sale Item failure was not raised'; end if;
  if (select count(*) from public.sales where lead_id=v_failure_lead_id) <> v_before_failure_sale_count
     or (select count(*) from public.sale_items si join public.sales s on s.id=si.sale_id where s.lead_id=v_failure_lead_id) <> v_before_failure_item_count
     or (select status from public.crm_leads where id=v_failure_lead_id) <> v_before_failure_status
     or (select count(*) from public.students where person_id=v_failure_person_id) <> v_before_failure_student_count
     or (select count(*) from public.crm_activities where lead_id=v_failure_lead_id and status='PENDING') <> v_before_failure_pending_count
     or (select count(*) from public.audit_logs where action='sales.created') <> v_before_failure_audit_count then
    raise exception 'Sale Item failure was not atomic';
  end if;

  -- Audit failure: Sale, Item, Student, Lead and Activity must also roll back.
  drop trigger sale_items_smoke_reject on public.sale_items;
  create function pg_temp.reject_audit_smoke() returns trigger language plpgsql as $fn$ begin raise exception 'controlled audit failure'; end; $fn$;
  create trigger audit_logs_smoke_reject before insert on public.audit_logs for each row execute function pg_temp.reject_audit_smoke();
  v_error := false; begin perform public.create_sale_from_commercial_offer(v_failure_lead_id,v_offer_id,v_plan_id,0,null); exception when others then v_error := true; end;
  if not v_error then raise exception 'Controlled audit failure was not raised'; end if;
  if (select count(*) from public.sales where lead_id=v_failure_lead_id) <> v_before_failure_sale_count
     or (select count(*) from public.sale_items si join public.sales s on s.id=si.sale_id where s.lead_id=v_failure_lead_id) <> v_before_failure_item_count
     or (select status from public.crm_leads where id=v_failure_lead_id) <> v_before_failure_status
     or (select count(*) from public.students where person_id=v_failure_person_id) <> v_before_failure_student_count
     or (select count(*) from public.crm_activities where lead_id=v_failure_lead_id and status='PENDING') <> v_before_failure_pending_count
     or (select count(*) from public.audit_logs where action='sales.created') <> v_before_failure_audit_count then
    raise exception 'Audit failure was not atomic';
  end if;

  if (select count(*) from public.sales) <> v_before_sales + 2 or (select count(*) from public.sale_items) <> v_before_sale_items + 2 then
    raise exception 'Unexpected transactional positive-flow counts';
  end if;
  raise notice 'regular COURSE Sale Items dual-write smoke passed';
end;
$$;

rollback;
