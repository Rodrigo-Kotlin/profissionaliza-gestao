-- ============================================================================
-- FASE 2.5B — ENROLLMENTS RPCS
-- Automatic creation on Contract SIGNED, state machine and read APIs.
-- ============================================================================

begin;

create or replace function public._create_enrollment_from_signed_contract(
  p_contract_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
  v_sale record;
  v_enrollment record;
  v_student record;
  v_enrollment_id uuid;
  v_enrollment_code text;
begin
  select * into v_contract
  from public.contracts
  where id = p_contract_id
  for update;

  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if v_contract.status <> 'SIGNED' then
    raise exception 'Only signed contracts can create an enrollment' using errcode = '22023';
  end if;

  select * into v_sale
  from public.sales
  where id = v_contract.sale_id
  for update;

  if v_sale is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if v_sale.status <> 'CONFIRMED' then
    raise exception 'Only confirmed sales can create an enrollment' using errcode = '22023';
  end if;

  select * into v_enrollment
  from public.enrollments
  where contract_id = v_contract.id;

  if v_enrollment is not null then
    return json_build_object(
      'enrollment_id', v_enrollment.id,
      'enrollment_code', v_enrollment.enrollment_code,
      'status', v_enrollment.status,
      'created', false
    );
  end if;

  if v_contract.student_id is distinct from v_sale.student_id then
    raise exception 'Contract student does not match sale student' using errcode = '22023';
  end if;

  select * into v_student from public.students where id = v_sale.student_id;
  if v_student is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  v_enrollment_code := 'MAT-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.enrollment_code_seq')::text, 6, '0');

  insert into public.enrollments (
    enrollment_code, student_id, course_id, sale_id, contract_id,
    status, enrollment_date, created_by, updated_by
  ) values (
    v_enrollment_code, v_sale.student_id, v_sale.course_id, v_sale.id, v_contract.id,
    'PENDING', now(), auth.uid(), null
  )
  returning id into v_enrollment_id;

  perform public.write_audit_log(
    'enrollment.created', 'enrollment', v_enrollment_id::text,
    jsonb_build_object(
      'enrollment_id', v_enrollment_id::text,
      'enrollment_code', v_enrollment_code,
      'student_id', v_sale.student_id::text,
      'course_id', v_sale.course_id::text,
      'sale_id', v_sale.id::text,
      'contract_id', v_contract.id::text,
      'old_status', null,
      'new_status', 'PENDING'
    )
  );

  return json_build_object(
    'enrollment_id', v_enrollment_id,
    'enrollment_code', v_enrollment_code,
    'status', 'PENDING',
    'created', true
  );
end;
$$;

create or replace function public.create_enrollment_from_signed_contract(
  p_contract_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('enrollments.create') then
    raise exception 'Permission denied: enrollments.create' using errcode = '42501';
  end if;

  return public._create_enrollment_from_signed_contract(p_contract_id);
end;
$$;

create or replace function public.mark_contract_signed(
  p_contract_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
  v_enrollment json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.mark_signed') then
    raise exception 'Permission denied: contracts.mark_signed' using errcode = '42501';
  end if;

  select * into v_contract from public.contracts where id = p_contract_id for update;

  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if v_contract.status = 'SIGNED' then
    v_enrollment := public._create_enrollment_from_signed_contract(p_contract_id);
    return json_build_object(
      'contract_id', p_contract_id,
      'contract_code', v_contract.contract_code,
      'status', 'SIGNED',
      'enrollment', v_enrollment,
      'created', false
    );
  end if;

  if v_contract.status <> 'PENDING_SIGNATURE' then
    raise exception 'Only pending signature contracts can be marked as signed' using errcode = '22023';
  end if;

  update public.contracts set
    status = 'SIGNED',
    signed_at = now(),
    signature_confirmed_by = auth.uid(),
    updated_by = auth.uid()
  where id = p_contract_id;

  perform public.write_audit_log(
    'contracts.signed', 'contract', p_contract_id::text,
    jsonb_build_object(
      'contract_code', v_contract.contract_code,
      'sale_id', v_contract.sale_id::text,
      'previous_status', v_contract.status,
      'new_status', 'SIGNED'
    )
  );

  v_enrollment := public._create_enrollment_from_signed_contract(p_contract_id);

  return json_build_object(
    'contract_id', p_contract_id,
    'contract_code', v_contract.contract_code,
    'status', 'SIGNED',
    'enrollment', v_enrollment,
    'created', true
  );
end;
$$;

create or replace function public.activate_enrollment(
  p_enrollment_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_enrollment record;
  v_student_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_permission('enrollments.activate') then
    raise exception 'Permission denied: enrollments.activate' using errcode = '42501';
  end if;

  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment is null then
    raise exception 'Enrollment not found' using errcode = 'P0002';
  end if;
  if v_enrollment.status <> 'PENDING' then
    raise exception 'Only pending enrollments can be activated' using errcode = '22023';
  end if;

  update public.enrollments
  set status = 'ACTIVE', started_at = now(), updated_by = auth.uid()
  where id = p_enrollment_id;

  select status into v_student_status from public.students where id = v_enrollment.student_id for update;
  if v_student_status = 'PRE_CADASTRO' then
    update public.students set status = 'ATIVO', updated_by = auth.uid() where id = v_enrollment.student_id;
    insert into public.student_status_history(student_id, previous_status, new_status, reason, changed_by)
    values (v_enrollment.student_id, 'PRE_CADASTRO', 'ATIVO', 'Ativação da matrícula', auth.uid());
    perform public.write_audit_log(
      'student.status_changed', 'student', v_enrollment.student_id::text,
      jsonb_build_object('previous_status', 'PRE_CADASTRO', 'new_status', 'ATIVO', 'source', 'enrollment.activated')
    );
  end if;

  perform public.write_audit_log(
    'enrollment.activated', 'enrollment', p_enrollment_id::text,
    jsonb_build_object('enrollment_id', p_enrollment_id::text, 'enrollment_code', v_enrollment.enrollment_code,
      'student_id', v_enrollment.student_id::text, 'course_id', v_enrollment.course_id::text,
      'sale_id', v_enrollment.sale_id::text, 'contract_id', v_enrollment.contract_id::text,
      'old_status', 'PENDING', 'new_status', 'ACTIVE')
  );

  return json_build_object('enrollment_id', p_enrollment_id, 'enrollment_code', v_enrollment.enrollment_code, 'status', 'ACTIVE');
end;
$$;

create or replace function public.pause_enrollment(p_enrollment_id uuid, p_reason text)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_enrollment record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('enrollments.pause') then raise exception 'Permission denied: enrollments.pause' using errcode = '42501'; end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'Pause reason is required' using errcode = '22023'; end if;
  if char_length(trim(p_reason)) > 2000 then raise exception 'Pause reason must be at most 2000 characters' using errcode = '22023'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment is null then raise exception 'Enrollment not found' using errcode = 'P0002'; end if;
  if v_enrollment.status <> 'ACTIVE' then raise exception 'Only active enrollments can be paused' using errcode = '22023'; end if;
  update public.enrollments set status = 'PAUSED', paused_at = now(), pause_reason = trim(p_reason), updated_by = auth.uid() where id = p_enrollment_id;
  perform public.write_audit_log('enrollment.paused', 'enrollment', p_enrollment_id::text, jsonb_build_object('enrollment_id', p_enrollment_id::text, 'enrollment_code', v_enrollment.enrollment_code, 'student_id', v_enrollment.student_id::text, 'course_id', v_enrollment.course_id::text, 'sale_id', v_enrollment.sale_id::text, 'contract_id', v_enrollment.contract_id::text, 'old_status', 'ACTIVE', 'new_status', 'PAUSED', 'has_reason', true));
  return json_build_object('enrollment_id', p_enrollment_id, 'enrollment_code', v_enrollment.enrollment_code, 'status', 'PAUSED');
end; $$;

create or replace function public.resume_enrollment(p_enrollment_id uuid)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_enrollment record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('enrollments.resume') then raise exception 'Permission denied: enrollments.resume' using errcode = '42501'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment is null then raise exception 'Enrollment not found' using errcode = 'P0002'; end if;
  if v_enrollment.status <> 'PAUSED' then raise exception 'Only paused enrollments can be resumed' using errcode = '22023'; end if;
  update public.enrollments set status = 'ACTIVE', pause_reason = null, updated_by = auth.uid() where id = p_enrollment_id;
  perform public.write_audit_log('enrollment.resumed', 'enrollment', p_enrollment_id::text, jsonb_build_object('enrollment_id', p_enrollment_id::text, 'enrollment_code', v_enrollment.enrollment_code, 'student_id', v_enrollment.student_id::text, 'course_id', v_enrollment.course_id::text, 'sale_id', v_enrollment.sale_id::text, 'contract_id', v_enrollment.contract_id::text, 'old_status', 'PAUSED', 'new_status', 'ACTIVE'));
  return json_build_object('enrollment_id', p_enrollment_id, 'enrollment_code', v_enrollment.enrollment_code, 'status', 'ACTIVE');
end; $$;

create or replace function public.complete_enrollment(p_enrollment_id uuid)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_enrollment record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('enrollments.complete') then raise exception 'Permission denied: enrollments.complete' using errcode = '42501'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment is null then raise exception 'Enrollment not found' using errcode = 'P0002'; end if;
  if v_enrollment.status <> 'ACTIVE' then raise exception 'Only active enrollments can be completed' using errcode = '22023'; end if;
  update public.enrollments set status = 'COMPLETED', completed_at = now(), updated_by = auth.uid() where id = p_enrollment_id;
  perform public.write_audit_log('enrollment.completed', 'enrollment', p_enrollment_id::text, jsonb_build_object('enrollment_id', p_enrollment_id::text, 'enrollment_code', v_enrollment.enrollment_code, 'student_id', v_enrollment.student_id::text, 'course_id', v_enrollment.course_id::text, 'sale_id', v_enrollment.sale_id::text, 'contract_id', v_enrollment.contract_id::text, 'old_status', 'ACTIVE', 'new_status', 'COMPLETED'));
  return json_build_object('enrollment_id', p_enrollment_id, 'enrollment_code', v_enrollment.enrollment_code, 'status', 'COMPLETED');
end; $$;

create or replace function public.cancel_enrollment(p_enrollment_id uuid, p_reason text)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_enrollment record;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('enrollments.cancel') then raise exception 'Permission denied: enrollments.cancel' using errcode = '42501'; end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then raise exception 'Cancellation reason is required' using errcode = '22023'; end if;
  if char_length(trim(p_reason)) > 2000 then raise exception 'Cancellation reason must be at most 2000 characters' using errcode = '22023'; end if;
  select * into v_enrollment from public.enrollments where id = p_enrollment_id for update;
  if v_enrollment is null then raise exception 'Enrollment not found' using errcode = 'P0002'; end if;
  if v_enrollment.status not in ('PENDING','ACTIVE','PAUSED') then raise exception 'Only pending, active or paused enrollments can be canceled' using errcode = '22023'; end if;
  update public.enrollments set status = 'CANCELED', canceled_at = now(), cancellation_reason = trim(p_reason), pause_reason = null, updated_by = auth.uid() where id = p_enrollment_id;
  perform public.write_audit_log('enrollment.canceled', 'enrollment', p_enrollment_id::text, jsonb_build_object('enrollment_id', p_enrollment_id::text, 'enrollment_code', v_enrollment.enrollment_code, 'student_id', v_enrollment.student_id::text, 'course_id', v_enrollment.course_id::text, 'sale_id', v_enrollment.sale_id::text, 'contract_id', v_enrollment.contract_id::text, 'old_status', v_enrollment.status, 'new_status', 'CANCELED'));
  return json_build_object('enrollment_id', p_enrollment_id, 'enrollment_code', v_enrollment.enrollment_code, 'status', 'CANCELED');
end; $$;

create or replace function public.list_enrollments(
  p_q text default null,
  p_status text default null,
  p_course_id uuid default null,
  p_date_from date default null,
  p_date_to date default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_all boolean; v_page integer; v_size integer; v_total bigint; v_data json;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('enrollments.view') then raise exception 'Permission denied: enrollments.view' using errcode = '42501'; end if;
  v_all := public.has_permission('enrollments.view_all');
  v_page := greatest(coalesce(p_page, 1), 1); v_size := least(greatest(coalesce(p_page_size, 20), 1), 100);
  select count(*) into v_total from public.enrollments e join public.students st on st.id = e.student_id join public.people pe on pe.id = st.person_id join public.sales sa on sa.id = e.sale_id where (v_all or sa.seller_user_id = auth.uid()) and (p_status is null or e.status = p_status) and (p_course_id is null or e.course_id = p_course_id) and (p_date_from is null or e.enrollment_date::date >= p_date_from) and (p_date_to is null or e.enrollment_date::date <= p_date_to) and (p_q is null or p_q = '' or e.enrollment_code ilike '%' || p_q || '%' or st.student_code ilike '%' || p_q || '%' or pe.full_name ilike '%' || p_q || '%' or sa.sale_code ilike '%' || p_q || '%');
  select coalesce(json_agg(row_to_json(x)), '[]'::json) into v_data from (select e.id enrollment_id, e.enrollment_code, e.status, e.enrollment_date, e.student_id, st.student_code, pe.full_name student_name, e.course_id, c.name course_name, e.sale_id, sa.sale_code, e.contract_id, co.contract_code from public.enrollments e join public.students st on st.id = e.student_id join public.people pe on pe.id = st.person_id join public.courses c on c.id = e.course_id join public.sales sa on sa.id = e.sale_id join public.contracts co on co.id = e.contract_id where (v_all or sa.seller_user_id = auth.uid()) and (p_status is null or e.status = p_status) and (p_course_id is null or e.course_id = p_course_id) and (p_date_from is null or e.enrollment_date::date >= p_date_from) and (p_date_to is null or e.enrollment_date::date <= p_date_to) and (p_q is null or p_q = '' or e.enrollment_code ilike '%' || p_q || '%' or st.student_code ilike '%' || p_q || '%' or pe.full_name ilike '%' || p_q || '%' or sa.sale_code ilike '%' || p_q || '%') order by e.enrollment_date desc, e.id limit v_size offset (v_page - 1) * v_size) x;
  return json_build_object('data', v_data, 'page', v_page, 'page_size', v_size, 'total', v_total);
end; $$;

create or replace function public.get_enrollment_detail(p_enrollment_id uuid)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_all boolean; v_result json;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('enrollments.view') then raise exception 'Permission denied: enrollments.view' using errcode = '42501'; end if;
  v_all := public.has_permission('enrollments.view_all');
  select json_build_object('enrollment', row_to_json(e), 'student', json_build_object('id', st.id, 'student_code', st.student_code, 'name', pe.full_name, 'status', st.status), 'course', json_build_object('id', c.id, 'code', c.code, 'name', c.name, 'status', c.status), 'sale', json_build_object('id', sa.id, 'sale_code', sa.sale_code, 'status', sa.status), 'contract', json_build_object('id', co.id, 'contract_code', co.contract_code, 'status', co.status)) into v_result from public.enrollments e join public.students st on st.id = e.student_id join public.people pe on pe.id = st.person_id join public.courses c on c.id = e.course_id join public.sales sa on sa.id = e.sale_id join public.contracts co on co.id = e.contract_id where e.id = p_enrollment_id and (v_all or sa.seller_user_id = auth.uid());
  if v_result is null then raise exception 'Enrollment not found' using errcode = 'P0002'; end if;
  return v_result;
end; $$;

revoke all on function public._create_enrollment_from_signed_contract(uuid) from public, anon, authenticated;
revoke execute on function public.create_enrollment_from_signed_contract(uuid) from public, anon;
revoke execute on function public.mark_contract_signed(uuid) from public, anon;
revoke execute on function public.activate_enrollment(uuid) from public, anon;
revoke execute on function public.pause_enrollment(uuid,text) from public, anon;
revoke execute on function public.resume_enrollment(uuid) from public, anon;
revoke execute on function public.complete_enrollment(uuid) from public, anon;
revoke execute on function public.cancel_enrollment(uuid,text) from public, anon;
revoke execute on function public.list_enrollments(text,text,uuid,date,date,integer,integer) from public, anon;
revoke execute on function public.get_enrollment_detail(uuid) from public, anon;

grant execute on function public.create_enrollment_from_signed_contract(uuid) to authenticated;
grant execute on function public.mark_contract_signed(uuid) to authenticated;
grant execute on function public.activate_enrollment(uuid) to authenticated;
grant execute on function public.pause_enrollment(uuid,text) to authenticated;
grant execute on function public.resume_enrollment(uuid) to authenticated;
grant execute on function public.complete_enrollment(uuid) to authenticated;
grant execute on function public.cancel_enrollment(uuid,text) to authenticated;
grant execute on function public.list_enrollments(text,text,uuid,date,date,integer,integer) to authenticated;
grant execute on function public.get_enrollment_detail(uuid) to authenticated;

commit;
