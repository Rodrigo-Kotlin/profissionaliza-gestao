-- ---------------------------------------------------------------------------
-- list_crm_pipeline — include l.status in the card payload
--
-- Root cause: the frontend gates the drag handle and the mobile "Mover para"
-- select on `lead.status === 'OPEN'` (CrmLeadCard.status is a required field
-- in crm-types.ts), but this SELECT never returned l.status. The field was
-- therefore undefined at runtime, isDraggable became false for every lead and
-- the drag handle never rendered in a real browser (tests passed because the
-- mocked payload included status).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_crm_pipeline(
  p_owner_user_id uuid default null,
  p_limit integer default 50
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_columns json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');

  select coalesce(json_agg(col order by st.position), '[]'::json)
  into v_columns
  from (
    select
      st.id as stage_id,
      st.code as stage_code,
      st.name as stage_name,
      st.position,
      (select count(*)::int from public.crm_leads l
        where l.stage_id = st.id
          and l.status = 'OPEN'
          and (v_has_view_all or l.owner_user_id = auth.uid())
          and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
      ) as total_count
    from public.crm_pipeline_stages st
    where st.is_active
    order by st.position
  ) st
  cross join lateral (
    select json_build_object(
      'stage_id', st.stage_id,
      'stage_code', st.stage_code,
      'stage_name', st.stage_name,
      'position', st.position,
      'total_count', st.total_count,
      'leads', coalesce((
        select json_agg(card order by card.created_at)
        from (
          select
            l.id,
            l.lead_code,
            l.status,
            p.full_name,
            c.name as course_name,
            l.temperature,
            pr.full_name as owner_name,
            l.owner_user_id,
            l.created_at,
            l.updated_at,
            extract(day from now() - l.created_at)::int as days_in_stage,
            (select count(*)::int from public.crm_activities a
              where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
            ) as overdue_activities,
            (select count(*)::int from public.crm_activities a
              where a.lead_id = l.id and a.status = 'PENDING'
            ) as pending_activities
          from public.crm_leads l
          join public.people p on p.id = l.person_id
          left join public.courses c on c.id = l.course_interest_id
          left join public.profiles pr on pr.id = l.owner_user_id
          where l.stage_id = st.stage_id
            and l.status = 'OPEN'
            and (v_has_view_all or l.owner_user_id = auth.uid())
            and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
          order by l.created_at
          limit p_limit
        ) card
      ), '[]'::json)
    ) as col
  ) col;

  return json_build_object('columns', v_columns);
end;
$$;