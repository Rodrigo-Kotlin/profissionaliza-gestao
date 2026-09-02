-- ============================================================================
-- FASE 2.1 (complemento) — EDIÇÃO DE DADOS DO ALUNO
-- ============================================================================
-- RPC update_student: edita dados da people (identidade) e do students
-- (origin/notes), respeitando students.view_sensitive para permitir/restringir
-- campos sensíveis e students.edit para autorizar a operação.
-- O CPF nunca é editado (é a chave de identidade; mudanças devem passar por um
-- fluxo controlado de correção que ainda não é escopo desta fase).
-- ============================================================================

begin;

create or replace function public.update_student(
  p_student_id uuid,
  p_full_name text,
  p_preferred_name text default null,
  p_birth_date date default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_postal_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_notes text default null,
  p_origin text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sensitive boolean;
  v_person_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.edit') then
    raise exception 'Permission denied: students.edit' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('students.view_sensitive');

  select person_id into v_person_id from public.students where id = p_student_id for update;
  if v_person_id is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;

  -- Atualiza people (identidade). Campos sensíveis (email/telefone/whatsapp/
  -- endereço) só podem ser retornados/editados por quem possui view_sensitive.
  update public.people
     set full_name = trim(p_full_name),
         preferred_name = nullif(trim(coalesce(p_preferred_name, '')), ''),
         birth_date = p_birth_date,
         email = case when v_sensitive then nullif(lower(trim(coalesce(p_email, ''))), '') else email end,
         phone = case when v_sensitive then nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') else phone end,
         whatsapp = case when v_sensitive then nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '') else whatsapp end,
         postal_code = case when v_sensitive then nullif(regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g'), '') else postal_code end,
         street = case when v_sensitive then nullif(trim(coalesce(p_street, '')), '') else street end,
         number = case when v_sensitive then nullif(trim(coalesce(p_number, '')), '') else number end,
         complement = case when v_sensitive then nullif(trim(coalesce(p_complement, '')), '') else complement end,
         district = case when v_sensitive then nullif(trim(coalesce(p_district, '')), '') else district end,
         city = case when v_sensitive then nullif(trim(coalesce(p_city, '')), '') else city end,
         state = case when v_sensitive then nullif(upper(trim(coalesce(p_state, ''))), '') else state end,
         emergency_contact_name = case when v_sensitive then nullif(trim(coalesce(p_emergency_contact_name, '')), '') else emergency_contact_name end,
         emergency_contact_phone = case when v_sensitive then nullif(regexp_replace(coalesce(p_emergency_contact_phone, ''), '\D', '', 'g'), '') else emergency_contact_phone end,
         updated_by = auth.uid()
   where id = v_person_id;

  update public.students
     set notes = nullif(trim(coalesce(p_notes, '')), ''),
         origin = nullif(trim(coalesce(p_origin, '')), ''),
         updated_by = auth.uid()
   where id = p_student_id;

  perform public.write_audit_log(
    'student.updated', 'student', p_student_id::text,
    jsonb_build_object('person_id', v_person_id::text)
  );
end;
$$;

grant execute on function public.update_student(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
revoke execute on function public.update_student(uuid,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;

commit;