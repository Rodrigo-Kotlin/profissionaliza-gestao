-- FASE 2.5C — LEITURA DE MATRÍCULAS POR ALUNO
-- Mantém o domínio RPC-only e adiciona o filtro necessário ao Student Detail.

begin;

drop function if exists public.list_enrollments(text,text,uuid,date,date,integer,integer);

create or replace function public.list_enrollments(
  p_q text default null,
  p_status text default null,
  p_course_id uuid default null,
  p_student_id uuid default null,
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
  v_page := greatest(coalesce(p_page, 1), 1);
  v_size := least(greatest(coalesce(p_page_size, 20), 1), 100);

  select count(*) into v_total
  from public.enrollments e
  join public.students st on st.id = e.student_id
  join public.people pe on pe.id = st.person_id
  join public.sales sa on sa.id = e.sale_id
  where (v_all or sa.seller_user_id = auth.uid())
    and (p_student_id is null or e.student_id = p_student_id)
    and (p_status is null or e.status = p_status)
    and (p_course_id is null or e.course_id = p_course_id)
    and (p_date_from is null or e.enrollment_date::date >= p_date_from)
    and (p_date_to is null or e.enrollment_date::date <= p_date_to)
    and (p_q is null or p_q = '' or e.enrollment_code ilike '%' || p_q || '%'
      or st.student_code ilike '%' || p_q || '%'
      or pe.full_name ilike '%' || p_q || '%'
      or sa.sale_code ilike '%' || p_q || '%');

  select coalesce(json_agg(row_to_json(x)), '[]'::json) into v_data
  from (
    select
      e.id enrollment_id,
      e.enrollment_code,
      e.status,
      e.enrollment_date,
      e.student_id,
      st.student_code,
      pe.full_name student_name,
      e.course_id,
      c.code course_code,
      c.name course_name,
      e.sale_id,
      sa.sale_code,
      e.contract_id,
      co.contract_code
    from public.enrollments e
    join public.students st on st.id = e.student_id
    join public.people pe on pe.id = st.person_id
    join public.courses c on c.id = e.course_id
    join public.sales sa on sa.id = e.sale_id
    join public.contracts co on co.id = e.contract_id
    where (v_all or sa.seller_user_id = auth.uid())
      and (p_student_id is null or e.student_id = p_student_id)
      and (p_status is null or e.status = p_status)
      and (p_course_id is null or e.course_id = p_course_id)
      and (p_date_from is null or e.enrollment_date::date >= p_date_from)
      and (p_date_to is null or e.enrollment_date::date <= p_date_to)
      and (p_q is null or p_q = '' or e.enrollment_code ilike '%' || p_q || '%'
        or st.student_code ilike '%' || p_q || '%'
        or pe.full_name ilike '%' || p_q || '%'
        or sa.sale_code ilike '%' || p_q || '%')
    order by e.enrollment_date desc, e.id
    limit v_size offset (v_page - 1) * v_size
  ) x;

  return json_build_object('data', v_data, 'page', v_page, 'page_size', v_size, 'total', v_total);
end; $$;

revoke execute on function public.list_enrollments(text,text,uuid,uuid,date,date,integer,integer) from public, anon;
grant execute on function public.list_enrollments(text,text,uuid,uuid,date,date,integer,integer) to authenticated;

commit;
