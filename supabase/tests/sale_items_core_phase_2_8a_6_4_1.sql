-- FASE 2.8A.6.4.1 — SALE_ITEMS CORE SMOKE
-- Safe to run in a transaction: all fixture writes are rolled back.
begin;

do $$
declare
  v_sale_id uuid;
  v_second_sale_id uuid;
  v_zero_sale_id uuid;
  v_course_id uuid;
  v_second_course_id uuid;
  v_fixture_course_id uuid;
  v_offer_item_id uuid;
  v_item_id uuid;
  v_data json;
  v_detail jsonb;
  v_before_name text;
  v_before_sort_order integer;
  v_error boolean;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='sale_items'
  ) then raise exception 'sale_items table is missing'; end if;

  foreach v_before_name in array array[
    'id','sale_id','position','course_id','offer_item_id',
    'course_code_snapshot','course_name_snapshot','course_workload_snapshot',
    'course_modality_snapshot','created_at','created_by'
  ] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='sale_items' and column_name=v_before_name
    ) then raise exception 'Missing sale_items column %', v_before_name; end if;
  end loop;

  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='sale_items' and column_name='sale_id') <> 'NO'
     or (select is_nullable from information_schema.columns where table_schema='public' and table_name='sale_items' and column_name='position') <> 'NO'
     or (select is_nullable from information_schema.columns where table_schema='public' and table_name='sale_items' and column_name='course_id') <> 'NO'
     or (select is_nullable from information_schema.columns where table_schema='public' and table_name='sale_items' and column_name='course_name_snapshot') <> 'NO' then
    raise exception 'Required sale_items columns are nullable';
  end if;

  if not exists (select 1 from pg_constraint where conrelid='public.sale_items'::regclass and contype='p') then raise exception 'sale_items primary key missing'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.sale_items'::regclass and conname='sale_items_position_check') then raise exception 'position check missing'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.sale_items'::regclass and conname='sale_items_sale_position_key') then raise exception 'unique sale position missing'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.sale_items'::regclass and conname='sale_items_sale_course_key') then raise exception 'unique sale course missing'; end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.sale_items'::regclass and c.contype='f'
      and c.conname='sale_items_sale_id_fkey'
      and pg_get_constraintdef(c.oid) like '%ON DELETE RESTRICT%'
  ) then raise exception 'sale_id RESTRICT FK missing'; end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.sale_items'::regclass and c.contype='f'
      and c.conname='sale_items_course_id_fkey'
      and pg_get_constraintdef(c.oid) like '%ON DELETE RESTRICT%'
  ) then raise exception 'course_id RESTRICT FK missing'; end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.sale_items'::regclass and c.contype='f'
      and c.conname='sale_items_offer_item_id_fkey'
      and pg_get_constraintdef(c.oid) like '%ON DELETE RESTRICT%'
  ) then raise exception 'offer_item_id RESTRICT FK missing'; end if;

  if not exists (select 1 from pg_class where oid='public.sale_items'::regclass and relrowsecurity) then raise exception 'sale_items RLS is disabled'; end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='sale_items') then raise exception 'sale_items must have zero direct policies'; end if;
  if has_table_privilege('authenticated','public.sale_items','SELECT')
     or has_table_privilege('authenticated','public.sale_items','INSERT')
     or has_table_privilege('authenticated','public.sale_items','UPDATE')
     or has_table_privilege('authenticated','public.sale_items','DELETE') then
    raise exception 'sale_items has direct authenticated grants';
  end if;

  foreach v_before_name in array array['sale_items_course_id_idx','sale_items_offer_item_id_idx'] loop
    if not exists (select 1 from pg_indexes where schemaname='public' and indexname=v_before_name) then raise exception 'Missing index %', v_before_name; end if;
  end loop;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='list_sale_items'
      and pg_get_function_identity_arguments(p.oid)='p_sale_id uuid'
      and p.prosecdef
      and pg_get_functiondef(p.oid) ilike '%set search_path = pg_catalog, public%'
      and pg_get_functiondef(p.oid) ilike '%set row_security = off%'
  ) then raise exception 'list_sale_items security definition mismatch'; end if;
  if has_function_privilege('anon','public.list_sale_items(uuid)','EXECUTE') then raise exception 'anon can execute list_sale_items'; end if;
  if not has_function_privilege('authenticated','public.list_sale_items(uuid)','EXECUTE') then raise exception 'authenticated cannot execute list_sale_items'; end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='get_sale_detail'
        and pg_get_function_identity_arguments(p.oid)='p_sale_id uuid') <> 1 then
    raise exception 'get_sale_detail signature is duplicated or missing';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_sale_detail'
      and pg_get_function_identity_arguments(p.oid)='p_sale_id uuid'
      and p.prosecdef
      and pg_get_functiondef(p.oid) ilike '%set search_path = pg_catalog, public%'
      and pg_get_functiondef(p.oid) ilike '%set row_security = off%'
  ) then raise exception 'get_sale_detail security definition mismatch'; end if;

  if (select count(*) from public.sales) <> 15 then raise exception 'Historical sales count changed'; end if;
  if (select count(*) from public.sale_items) <> 0 then raise exception 'Historical sales were backfilled'; end if;

  select id into v_sale_id from public.sales order by created_at limit 1;
  select id into v_second_sale_id
  from public.sales s
  where s.id <> v_sale_id
    and not exists (select 1 from public.contracts c where c.sale_id=s.id)
    and not exists (select 1 from public.enrollments e where e.sale_id=s.id)
  order by s.created_at desc limit 1;
  if v_second_sale_id is null then raise exception 'No isolated Sale fixture available'; end if;
  select id into v_zero_sale_id from public.sales where id not in (v_sale_id,v_second_sale_id) order by created_at limit 1;
  select id into v_course_id from public.courses order by created_at limit 1;
  select id into v_second_course_id from public.courses where id <> v_course_id order by created_at limit 1;
  select id into v_offer_item_id from public.offer_items order by created_at limit 1;
  select name into v_before_name from public.courses where id=v_course_id;
  select sort_order into v_before_sort_order from public.offer_items where id=v_offer_item_id;

  insert into public.sale_items(
    sale_id, position, course_id, offer_item_id, course_code_snapshot,
    course_name_snapshot, course_workload_snapshot, course_modality_snapshot
  ) values (
    v_sale_id, 1, v_course_id, v_offer_item_id, 'SMOKE-COURSE',
    'SMOKE COURSE SNAPSHOT', 120, 'ONLINE'
  ) returning id into v_item_id;

  insert into public.sale_items(
    sale_id, position, course_id, course_name_snapshot, course_workload_snapshot, course_modality_snapshot
  ) values (
    v_sale_id, 2, v_second_course_id, 'SECOND COURSE SNAPSHOT', 120, 'ONLINE'
  );

  -- The same course is valid in a different Sale.
  insert into public.sale_items(sale_id,position,course_id,course_name_snapshot)
  values (v_second_sale_id,1,v_course_id,'SAME COURSE OTHER SALE');

  v_error := false;
  begin
    insert into public.sale_items(sale_id,position,course_id,course_name_snapshot)
    values (v_sale_id,1,v_course_id,'DUPLICATE POSITION');
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Duplicate position was accepted'; end if;

  v_error := false;
  begin
    insert into public.sale_items(sale_id,position,course_id,course_name_snapshot)
    values (v_sale_id,2,v_course_id,'DUPLICATE COURSE');
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Duplicate course was accepted'; end if;

  v_error := false;
  begin
    insert into public.sale_items(sale_id,position,course_id,course_name_snapshot)
    values (v_sale_id,0,(select id from public.courses order by created_at offset 1 limit 1),'INVALID POSITION');
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Position zero was accepted'; end if;

  v_error := false;
  begin
    insert into public.sale_items(sale_id,position,course_id,course_name_snapshot)
    values ('00000000-0000-0000-0000-000000000000',2,v_course_id,'INVALID SALE');
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Invalid sale_id was accepted'; end if;

  v_error := false;
  begin
    insert into public.sale_items(sale_id,position,course_id,course_name_snapshot)
    values (v_sale_id,2,'00000000-0000-0000-0000-000000000000','INVALID COURSE');
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Invalid course_id was accepted'; end if;

  v_error := false;
  begin
    insert into public.sale_items(sale_id,position,course_id,offer_item_id,course_name_snapshot)
    values (v_sale_id,2,(select id from public.courses order by created_at offset 1 limit 1),'00000000-0000-0000-0000-000000000000','INVALID OFFER ITEM');
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Invalid offer_item_id was accepted'; end if;

  -- NULL provenance is valid for the regular COURSE transition phase.
  if (select count(*) from public.sale_items where sale_id=v_sale_id and offer_item_id is null) <> 1 then
    raise exception 'NULL offer_item_id was not accepted';
  end if;

  perform set_config('request.jwt.claim.sub', (select seller_user_id::text from public.sales where id=v_sale_id), true);
  v_data := public.list_sale_items(v_zero_sale_id);
  if json_array_length(v_data) <> 0 then raise exception 'Zero-item Sale did not return []'; end if;
  v_data := public.list_sale_items(v_sale_id);
  if json_array_length(v_data) <> 2
     or (v_data->0->>'position')::integer <> 1
     or (v_data->1->>'position')::integer <> 2 then
    raise exception 'Sale Items were not returned in position order';
  end if;
  v_detail := public.get_sale_detail(v_sale_id)::jsonb;
  if (v_detail->>'item_count')::integer <> 2 or jsonb_array_length(v_detail->'items') <> 2 then
    raise exception 'get_sale_detail item payload mismatch';
  end if;

  -- Create an isolated course fixture so the DELETE restriction is attributable
  -- to sale_items rather than to unrelated catalog references.
  insert into public.courses(code,name,modality,workload_hours,status)
  values ('SMOKE-SALE-ITEM','SMOKE SALE ITEM COURSE','ONLINE',120,'DRAFT')
  returning id into v_fixture_course_id;
  insert into public.sale_items(sale_id,position,course_id,course_name_snapshot)
  values (v_sale_id,3,v_fixture_course_id,'ISOLATED COURSE SNAPSHOT');

  v_error := false;
  begin
    delete from public.sales where id=v_second_sale_id;
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Referenced Sale deletion was accepted'; end if;

  v_error := false;
  begin
    delete from public.courses where id=v_fixture_course_id;
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Referenced Course deletion was accepted'; end if;

  v_error := false;
  begin
    delete from public.offer_items where id=v_offer_item_id;
  exception when others then v_error := true;
  end;
  if not v_error then raise exception 'Referenced Offer Item deletion was accepted'; end if;

  update public.courses set name='MUTATED COURSE' where id=v_course_id;
  update public.offer_items set sort_order=99 where id=v_offer_item_id;
  if (select course_name_snapshot from public.sale_items where id=v_item_id) <> 'SMOKE COURSE SNAPSHOT' then raise exception 'Course mutation changed Sale Item snapshot'; end if;
  if (select sort_order from public.offer_items where id=v_offer_item_id) <> 99 then raise exception 'Offer Item fixture did not update'; end if;
  if (select course_name_snapshot from public.sale_items where id=v_item_id) <> 'SMOKE COURSE SNAPSHOT' then raise exception 'Offer Item mutation changed Sale Item snapshot'; end if;

  raise notice 'sale_items core smoke passed';
end;
$$;

rollback;
