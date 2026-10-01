-- FASE 2.5B — CORREÇÃO DE IDEMPOTÊNCIA
-- RECORDs com colunas nullable não devem ser testados com IS NOT NULL.

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
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;
  if v_contract.status <> 'SIGNED' then
    raise exception 'Only signed contracts can create an enrollment' using errcode = '22023';
  end if;

  select * into v_sale from public.sales where id = v_contract.sale_id for update;
  if v_sale is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;
  if v_sale.status <> 'CONFIRMED' then
    raise exception 'Only confirmed sales can create an enrollment' using errcode = '22023';
  end if;

  select * into v_enrollment from public.enrollments where contract_id = v_contract.id;
  if found then
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
  ) returning id into v_enrollment_id;

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

commit;
