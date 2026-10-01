-- ---------------------------------------------------------------------------
-- Smoke test — Fase 2.5B (DEV only)
-- Executar com: npx supabase db query --linked --file supabase/tests/enrollments_smoke.sql
-- Tudo ocorre em uma transação e termina com ROLLBACK.
-- ---------------------------------------------------------------------------

begin;

do $$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_person_id uuid;
  v_student_id uuid;
  v_course_id uuid;
  v_stage_id uuid;
  v_source_id uuid;
  v_lead_id uuid;
  v_sale_id uuid;
  v_contract_id uuid;
  v_enrollment_id uuid;
  v_status text;
  v_res json;
  v_error text;
  v_audit_count integer;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'No authenticated DEV user available for smoke test';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user_id::text)::text, true);

  select id into v_role_id from public.roles where code = 'ADMIN';
  insert into public.user_roles(user_id, role_id, created_by) values (v_user_id, v_role_id, v_user_id)
  on conflict do nothing;

  insert into public.people(full_name, cpf, created_by, updated_by)
  values ('Enrollment Smoke Pessoa', '90000000001', v_user_id, v_user_id)
  returning id into v_person_id;

  insert into public.students(person_id, student_code, status, registration_date, created_by, updated_by)
  values (v_person_id, 'ALU-2099-999991', 'PRE_CADASTRO', current_date, v_user_id, v_user_id)
  returning id into v_student_id;

  insert into public.courses(code, name, modality, workload_hours, status, created_by, updated_by)
  values ('SMOKE-25', 'Enrollment Smoke Course', 'ONLINE', 20, 'ACTIVE', v_user_id, v_user_id)
  returning id into v_course_id;

  select id into v_stage_id from public.crm_pipeline_stages where code = 'NEGOTIATION' limit 1;
  select id into v_source_id from public.crm_lead_sources where code = 'OUTRO' limit 1;

  insert into public.crm_leads(
    lead_code, person_id, stage_id, source_id, course_interest_id, owner_user_id, status, created_by, updated_by
  ) values (
    'LEAD-2099-999991', v_person_id, v_stage_id, v_source_id, v_course_id, v_user_id, 'OPEN', v_user_id, v_user_id
  ) returning id into v_lead_id;

  insert into public.sales(
    sale_code, status, lead_id, person_id, student_id, course_id, course_name_snapshot,
    seller_user_id, gross_value, discount_value, payment_method, installments, created_by, updated_by
  ) values (
    'VND-2099-999991', 'CONFIRMED', v_lead_id, v_person_id, v_student_id, v_course_id,
    'Enrollment Smoke Course', v_user_id, 100, 0, 'PIX', 1, v_user_id, v_user_id
  ) returning id into v_sale_id;

  insert into public.contracts(
    contract_code, sale_id, student_id, contractor_person_id, status,
    student_name_snapshot, contractor_name_snapshot, course_name_snapshot,
    course_modality_snapshot, gross_value_snapshot, discount_value_snapshot,
    net_value_snapshot, payment_method_snapshot, installments_snapshot,
    issued_at, created_by, updated_by
  ) values (
    'CTR-2099-999991', v_sale_id, v_student_id, v_person_id, 'PENDING_SIGNATURE',
    'Enrollment Smoke Pessoa', 'Enrollment Smoke Pessoa', 'Enrollment Smoke Course',
    'ONLINE', 100, 0, 100, 'PIX', 1, now(), v_user_id, v_user_id
  ) returning id into v_contract_id;

  if has_table_privilege('anon', 'public.enrollments', 'select')
     or has_table_privilege('authenticated', 'public.enrollments', 'select') then
    raise exception 'enrollments exposes direct SELECT privilege';
  end if;

  begin
    perform public.create_enrollment_from_signed_contract(v_contract_id);
    raise exception 'non-signed contract was accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Only signed contracts can create an enrollment' then
      raise exception 'unexpected non-signed error: %', v_error;
    end if;
  end;

  update public.contracts set status = 'SIGNED', signed_at = now(), signature_confirmed_by = v_user_id where id = v_contract_id;
  update public.sales set status = 'CANCELED', canceled_at = now(), canceled_by = v_user_id, cancellation_reason = 'Smoke invalid sale' where id = v_sale_id;
  begin
    perform public.create_enrollment_from_signed_contract(v_contract_id);
    raise exception 'canceled sale was accepted';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Only confirmed sales can create an enrollment' then
      raise exception 'unexpected canceled sale error: %', v_error;
    end if;
  end;
  update public.sales set status = 'CONFIRMED', canceled_at = null, canceled_by = null, cancellation_reason = null where id = v_sale_id;
  update public.contracts set status = 'PENDING_SIGNATURE', signed_at = null, signature_confirmed_by = null where id = v_contract_id;

  v_res := public.mark_contract_signed(v_contract_id);
  v_enrollment_id := (v_res->'enrollment'->>'enrollment_id')::uuid;

  if v_res->>'status' is distinct from 'SIGNED' then
    raise exception 'mark_contract_signed did not return SIGNED';
  end if;
  if v_res->'enrollment'->>'status' is distinct from 'PENDING' then
    raise exception 'signed contract did not create PENDING enrollment';
  end if;

  select status into v_status from public.enrollments where id = v_enrollment_id;
  if v_status is distinct from 'PENDING' then raise exception 'expected PENDING enrollment'; end if;

  v_res := public.mark_contract_signed(v_contract_id);
  if (select count(*) from public.enrollments where contract_id = v_contract_id) <> 1 then
    raise exception 'mark_contract_signed duplicated enrollment';
  end if;

  perform public.activate_enrollment(v_enrollment_id);
  if (select status from public.students where id = v_student_id) <> 'ATIVO' then
    raise exception 'activation did not promote PRE_CADASTRO student';
  end if;

  perform public.pause_enrollment(v_enrollment_id, 'Smoke pause');
  if (select status from public.enrollments where id = v_enrollment_id) <> 'PAUSED' then
    raise exception 'activation did not transition to PAUSED';
  end if;

  perform public.resume_enrollment(v_enrollment_id);
  perform public.complete_enrollment(v_enrollment_id);
  if (select status from public.enrollments where id = v_enrollment_id) <> 'COMPLETED' then
    raise exception 'enrollment did not transition to COMPLETED';
  end if;
  if (select status from public.students where id = v_student_id) <> 'ATIVO' then
    raise exception 'completed enrollment downgraded student status';
  end if;
  select count(*) into v_audit_count from public.audit_logs where entity_type = 'enrollment' and entity_id = v_enrollment_id::text and action = 'enrollment.created';
  if v_audit_count <> 1 then
    raise exception 'expected exactly one enrollment.created audit, got %', v_audit_count;
  end if;

  begin
    perform public.cancel_enrollment(v_enrollment_id, 'Must fail: terminal state');
    raise exception 'terminal enrollment accepted cancellation';
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'Only pending, active or paused enrollments can be canceled' then
      raise exception 'unexpected terminal transition error: %', v_error;
    end if;
  end;

  raise notice 'OK: enrollment create, idempotency, all valid transitions, student promotion and terminal guard';
end;
$$;

rollback;
