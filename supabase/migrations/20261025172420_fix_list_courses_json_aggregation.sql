create or replace function public.list_courses(p_status text default 'ACTIVE')
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('courses.view') then
    raise exception 'Permission denied: courses.view' using errcode = '42501';
  end if;

  v_rows := coalesce(
    json_agg(row_to_json(c) order by c.name),
    '[]'::json
  )
  from (
    select
      c.id,
      c.code,
      c.name,
      c.short_name,
      c.category,
      c.modality,
      c.workload_hours,
      c.duration_value,
      c.duration_unit,
      c.default_price,
      c.status,
      c.business_review_status
    from public.courses c
    where (p_status is null or c.status = p_status)
    order by c.name
  ) c;

  return v_rows;
end;
$$;
