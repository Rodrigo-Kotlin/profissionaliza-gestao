-- FASE 2.8A.6.4.3 — SALES READ MODEL NORMALIZATION SMOKE
-- Read-model verification with transactional fixtures only. No persistent
-- write, no Lead dependency, no backfill and no live ONLINE_CATALOG sale.
begin;

do $$
declare
  v_fn_name text;
  v_args text;
  v_def text;
  v_legacy_sale_id uuid;
  v_single_sale_id uuid;
  v_multi_sale_id uuid;
  v_ownership_sale_id uuid;
  v_course_ids uuid[];
  v_filter_course_id uuid;
  v_actor uuid;
  v_limited_actor uuid;
  v_legacy_snapshot text;
  v_single_detail jsonb;
  v_multi_detail jsonb;
  v_five_detail jsonb;
  v_filter_list jsonb;
  v_base_list jsonb;
  v_page1 jsonb;
  v_page2 jsonb;
  v_error boolean;
  v_count integer;
  v_total bigint;
begin
  -- Signatures, security attributes and grants.
  for v_fn_name, v_args in
    select * from (values
      ('get_sale_detail', 'p_sale_id uuid'),
      ('list_sales', 'p_search text, p_status text, p_seller_user_id uuid, p_course_id uuid, p_date_from date, p_date_to date, p_page integer, p_page_size integer'),
      ('list_sale_items', 'p_sale_id uuid')
    ) as t(fn, args)
  loop
    if (select count(*)
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname = v_fn_name
           and pg_get_function_identity_arguments(p.oid) = v_args) <> 1 then
      raise exception 'Signature missing or duplicated: % (%)', v_fn_name, v_args;
    end if;

    select pg_get_functiondef(p.oid)
      into v_def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = v_fn_name
       and pg_get_function_identity_arguments(p.oid) = v_args;

    if not exists (
      select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = v_fn_name
         and pg_get_function_identity_arguments(p.oid) = v_args
         and p.prosecdef
    ) then
      raise exception '% must remain SECURITY DEFINER', v_fn_name;
    end if;

    if v_def not ilike '%set row_security to ''off''%'
       and v_def not ilike '%set row_security to off%' then
      raise exception '% must keep row_security=off', v_fn_name;
    end if;
    if v_def not ilike '%set search_path to pg_catalog, public%'
       and v_def not ilike '%set search_path to ''pg_catalog'', ''public''%' then
      raise exception '% must keep search_path=pg_catalog, public', v_fn_name;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.get_sale_detail(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_sales(text,text,uuid,uuid,date,date,integer,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_sale_items(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute Sales read RPCs';
  end if;
  if not has_function_privilege('authenticated', 'public.get_sale_detail(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_sales(text,text,uuid,uuid,date,date,integer,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_sale_items(uuid)', 'EXECUTE') then
    raise exception 'authenticated lost Sales read RPC grants';
  end if;
  if not has_function_privilege('service_role', 'public.get_sale_detail(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.list_sales(text,text,uuid,uuid,date,date,integer,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.list_sale_items(uuid)', 'EXECUTE') then
    raise exception 'service_role lost Sales read RPC grants';
  end if;

  -- Internal helpers stay internal.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='_sale_read_model_core'
      and pg_get_function_identity_arguments(p.oid)='p_sale_id uuid, p_legacy_course_name text, p_offer_type_snapshot text'
      and p.prosecdef
  ) then raise exception '_sale_read_model_core is missing'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='_sale_read_integrity_check'
      and pg_get_function_identity_arguments(p.oid)='p_item_count integer, p_items jsonb'
  ) then raise exception '_sale_read_integrity_check is missing'; end if;
  if has_function_privilege('anon', 'public._sale_read_model_core(uuid, text, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public._sale_read_model_core(uuid, text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public._sale_read_integrity_check(integer, jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public._sale_read_integrity_check(integer, jsonb)', 'EXECUTE') then
    raise exception 'Internal read-model helpers must not be API-callable';
  end if;

  -- Preserved boundaries.
  if (select is_nullable from information_schema.columns
       where table_schema='public' and table_name='sales' and column_name='course_id') <> 'NO' then
    raise exception 'sales.course_id must remain NOT NULL in this phase';
  end if;
  if not exists (select 1 from pg_class where oid='public.sale_items'::regclass and relrowsecurity) then
    raise exception 'sale_items RLS is disabled';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='sale_items') then
    raise exception 'sale_items must have zero direct policies';
  end if;
  if has_table_privilege('authenticated', 'public.sale_items', 'SELECT')
     or has_table_privilege('authenticated', 'public.sale_items', 'INSERT')
     or has_table_privilege('authenticated', 'public.sale_items', 'UPDATE')
     or has_table_privilege('authenticated', 'public.sale_items', 'DELETE') then
    raise exception 'authenticated has direct sale_items grants';
  end if;

  -- Fixtures come from existing rows and are all removed by ROLLBACK.
  select id into v_legacy_sale_id
    from public.sales s
   where not exists (select 1 from public.sale_items si where si.sale_id=s.id)
   order by s.created_at
   limit 1;
  select id into v_single_sale_id
    from public.sales s
   where s.id <> v_legacy_sale_id
     and not exists (select 1 from public.sale_items si where si.sale_id=s.id)
   order by s.created_at desc
   limit 1;
  select id into v_multi_sale_id
    from public.sales s
   where s.id not in (v_legacy_sale_id, v_single_sale_id)
     and not exists (select 1 from public.sale_items si where si.sale_id=s.id)
   order by s.created_at desc
   limit 1;
  if v_legacy_sale_id is null or v_single_sale_id is null or v_multi_sale_id is null then
    raise exception 'Not enough item-free Sale fixtures for the three read scenarios';
  end if;

  select array_agg(id order by created_at)
    into v_course_ids
    from (select id, created_at from public.courses order by created_at limit 5) c;
  if coalesce(array_length(v_course_ids, 1), 0) < 5 then
    raise exception 'Five Course fixtures are required for the simulated scenarios';
  end if;

  select id into v_filter_course_id
    from public.courses
   where id <> (select course_id from public.sales where id=v_single_sale_id)
   order by created_at
   limit 1;
  if v_filter_course_id is null then raise exception 'No distinct course for item-based filter'; end if;

  select ur.user_id into v_actor
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions p on p.id=rp.permission_id
   where p.code='sales.view_all'
   order by ur.user_id
   limit 1;
  if v_actor is null then
    select seller_user_id into v_actor from public.sales where id=v_legacy_sale_id;
  end if;
  if v_actor is null then raise exception 'No actor with sales.view_all available'; end if;

  select ur.user_id into v_limited_actor
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions p on p.id=rp.permission_id
   where p.code='sales.view'
     and not exists (
       select 1
         from public.user_roles ur2
         join public.role_permissions rp2 on rp2.role_id=ur2.role_id
         join public.permissions p2 on p2.id=rp2.permission_id
        where ur2.user_id=ur.user_id and p2.code='sales.view_all'
     )
   order by ur.user_id
   limit 1;
  if v_limited_actor is null then raise exception 'No limited sales viewer available'; end if;

  select id into v_ownership_sale_id
    from public.sales
   where seller_user_id is distinct from v_limited_actor
   order by created_at
   limit 1;
  if v_ownership_sale_id is null then raise exception 'No Sale owned by another seller available'; end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);

  -- Scenario A: historical Sale with zero items.
  v_single_detail := public.get_sale_detail(v_legacy_sale_id)::jsonb;
  if (v_single_detail->>'item_count')::integer <> 0
     or jsonb_array_length(v_single_detail->'items') <> 0
     or v_single_detail->>'course_display_mode' <> 'LEGACY'
     or v_single_detail->>'item_count_matches_items' <> 'true'
     or v_single_detail->>'commercial_type' <> 'LEGACY' then
    raise exception 'Historical Sale read model is invalid';
  end if;
  select course_name_snapshot into v_legacy_snapshot from public.sales where id=v_legacy_sale_id;
  if v_single_detail->>'course_summary' <> v_legacy_snapshot then
    raise exception 'Historical summary did not use the frozen Sale snapshot';
  end if;

  -- Scenario B: regular COURSE Sale with exactly one item.
  update public.sales set offer_type_snapshot='COURSE' where id=v_single_sale_id;
  insert into public.sale_items(
    sale_id, position, course_id, course_code_snapshot, course_name_snapshot,
    course_workload_snapshot, course_modality_snapshot
  ) values (
    v_single_sale_id, 1, v_filter_course_id, 'COURSE-001', 'Curso regular congelado', 80, 'PRESENCIAL'
  );

  v_single_detail := public.get_sale_detail(v_single_sale_id)::jsonb;
  if (v_single_detail->>'item_count')::integer <> 1
     or jsonb_array_length(v_single_detail->'items') <> 1
     or v_single_detail->>'course_display_mode' <> 'SINGLE'
     or v_single_detail->>'course_summary' <> 'Curso regular congelado'
     or v_single_detail->>'offer_type' <> 'COURSE'
     or v_single_detail->>'commercial_type' <> 'COURSE'
     or v_single_detail->>'item_count_matches_items' <> 'true' then
    raise exception 'Regular COURSE Sale read model is invalid';
  end if;

  -- Course filter also matches sale_items.course_id, not only sales.course_id.
  v_filter_list := public.list_sales(p_course_id => v_filter_course_id, p_page_size => 100)::jsonb;
  select count(*) into v_count
    from jsonb_array_elements(v_filter_list->'data') e(value)
   where (e.value->>'id')::uuid = v_single_sale_id;
  if v_count <> 1 then raise exception 'Item-based course filter did not return exactly one Sale row'; end if;

  -- The live catalog must not rebuild the summary.
  update public.courses
     set name = name || '-SMOKE-' || gen_random_uuid()::text
   where id=v_filter_course_id;
  v_single_detail := public.get_sale_detail(v_single_sale_id)::jsonb;
  if v_single_detail->>'course_summary' <> 'Curso regular congelado'
     or v_single_detail->'items'->0->>'course_name_snapshot' <> 'Curso regular congelado' then
    raise exception 'Live catalog mutation changed a Sale Item snapshot';
  end if;

  -- Scenario C: simulated ONLINE_CATALOG read with two items, inserted out of order.
  update public.sales set offer_type_snapshot='ONLINE_CATALOG' where id=v_multi_sale_id;
  insert into public.sale_items(
    sale_id, position, course_id, course_code_snapshot, course_name_snapshot,
    course_workload_snapshot, course_modality_snapshot
  ) values (
    v_multi_sale_id, 2, v_course_ids[2], 'ONL-002', 'Curso B congelado', 120, 'ONLINE'
  );
  insert into public.sale_items(
    sale_id, position, course_id, course_code_snapshot, course_name_snapshot,
    course_workload_snapshot, course_modality_snapshot
  ) values (
    v_multi_sale_id, 1, v_course_ids[1], 'ONL-001', 'Curso A congelado', 60, 'ONLINE'
  );

  v_multi_detail := public.get_sale_detail(v_multi_sale_id)::jsonb;
  if (v_multi_detail->>'item_count')::integer <> 2
     or jsonb_array_length(v_multi_detail->'items') <> 2
     or v_multi_detail->>'course_display_mode' <> 'MULTIPLE'
     or v_multi_detail->>'course_summary' <> '2 cursos'
     or v_multi_detail->>'commercial_type' <> 'ONLINE_CATALOG'
     or (v_multi_detail->'items'->0->>'position')::integer <> 1
     or v_multi_detail->'items'->0->>'course_name_snapshot' <> 'Curso A congelado'
     or (v_multi_detail->'items'->1->>'position')::integer <> 2
     or v_multi_detail->'items'->1->>'course_name_snapshot' <> 'Curso B congelado'
     or v_multi_detail->'item_count_matches_items' <> 'true' then
    raise exception 'Two-item simulated read model is invalid';
  end if;

  v_filter_list := public.list_sale_items(v_multi_sale_id)::jsonb;
  if jsonb_array_length(v_filter_list) <> 2
     or (v_filter_list->0->>'position')::integer <> 1
     or (v_filter_list->1->>'position')::integer <> 2 then
    raise exception 'list_sale_items ordering changed';
  end if;

  -- Five items on the same simulated Sale: N is read from items, not from offer type.
  insert into public.sale_items(
    sale_id, position, course_id, course_code_snapshot, course_name_snapshot,
    course_workload_snapshot, course_modality_snapshot
  ) values
    (v_multi_sale_id, 3, v_course_ids[3], 'ONL-003', 'Curso C congelado', 120, 'HIBRIDO'),
    (v_multi_sale_id, 4, v_course_ids[4], 'ONL-004', 'Curso D congelado', 80, 'PRESENCIAL'),
    (v_multi_sale_id, 5, v_course_ids[5], 'ONL-005', 'Curso E congelado', 40, 'ONLINE');

  v_five_detail := public.get_sale_detail(v_multi_sale_id)::jsonb;
  if (v_five_detail->>'item_count')::integer <> 5
     or jsonb_array_length(v_five_detail->'items') <> 5
     or v_five_detail->>'course_display_mode' <> 'MULTIPLE'
     or v_five_detail->>'course_summary' <> '5 cursos'
     or (v_five_detail->'items'->4->>'position')::integer <> 5
     or v_five_detail->'item_count_matches_items' <> 'true' then
    raise exception 'Five-item simulated read model is invalid';
  end if;

  -- Pagination keeps one row per Sale and preserves total/page/page_size.
  v_base_list := public.list_sales(p_page_size => 100)::jsonb;
  v_total := (v_base_list->>'total')::bigint;
  v_page1 := public.list_sales(p_page => 1, p_page_size => 2)::jsonb;
  v_page2 := public.list_sales(p_page => 2, p_page_size => 2)::jsonb;
  if (v_page1->>'total')::bigint <> v_total or (v_page2->>'total')::bigint <> v_total
     or (v_page1->>'page')::integer <> 1 or (v_page2->>'page')::integer <> 2
     or (v_page1->>'page_size')::integer <> 2 or (v_page2->>'page_size')::integer <> 2
     or jsonb_array_length(v_page1->'data') > 2
     or jsonb_array_length(v_page2->'data') > 2 then
    raise exception 'list_sales pagination envelope changed';
  end if;
  select count(*) = count(distinct (e.value->>'id'))
    into v_error
    from jsonb_array_elements(v_page1->'data') e(value);
  if not v_error then raise exception 'list_sales page 1 contains duplicate Sale rows'; end if;

  select count(*) = count(distinct (e.value->>'id'))
    into v_error
    from jsonb_array_elements(v_page2->'data') e(value);
  if not v_error then raise exception 'list_sales page 2 contains duplicate Sale rows'; end if;

  -- Authentication and ownership remain enforced by the wrappers.
  -- auth.uid() falls back to request.jwt.claims, so both claims must be reset.
  perform set_config('request.jwt.claim.sub', NULL, true);
  perform set_config('request.jwt.claims', NULL, true);
  v_error := false;
  begin
    perform public.get_sale_detail(v_legacy_sale_id);
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Anonymous detail read was accepted'; end if;

  perform set_config('request.jwt.claim.sub', v_limited_actor::text, true);
  v_error := false;
  begin
    perform public.get_sale_detail(v_ownership_sale_id);
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Foreign Sale detail read was accepted'; end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  raise notice 'sales read model normalization smoke passed';
end;
$$;

rollback;
