-- FASE 2.3: CRM SALES INTEGRATION
-- Update get_crm_lead_detail to return sale fields when WON
-- Update get_crm_lead_timeline to include LEAD_WON from audit_logs
begin;

-- =========================================================================
-- 1. get_crm_lead_detail — add sale fields for WON leads
-- =========================================================================
create or replace function public.get_crm_lead_detail(
  p_lead_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_user_id uuid;
  v_exists boolean;
  v_has_view_all boolean;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');

  select exists(select 1 from public.crm_leads where id = p_lead_id) into v_exists;
  if not v_exists then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  select owner_user_id into v_owner_user_id from public.crm_leads where id = p_lead_id;
  if v_owner_user_id is distinct from auth.uid() and not v_has_view_all then
    raise exception 'Not authorized to view this lead' using errcode = '42501';
  end if;

  select json_build_object(
    'id', l.id,
    'lead_code', l.lead_code,
    'person_id', l.person_id,
    'full_name', p.full_name,
    'phone', p.phone,
    'whatsapp', p.whatsapp,
    'email', p.email,
    'stage_id', l.stage_id,
    'stage_code', ps.code,
    'stage_name', ps.name,
    'source_id', l.source_id,
    'source_name', cs.name,
    'course_interest_id', l.course_interest_id,
    'course_name', crs.name,
    'owner_user_id', l.owner_user_id,
    'owner_name', pr.full_name,
    'status', l.status,
    'temperature', l.temperature,
    'qualification_start_period', l.qualification_start_period,
    'preferred_shift', l.preferred_shift,
    'preferred_modality', l.preferred_modality,
    'budget_notes', l.budget_notes,
    'decision_maker', l.decision_maker,
    'source_detail', l.source_detail,
    'utm_source', l.utm_source,
    'utm_medium', l.utm_medium,
    'utm_campaign', l.utm_campaign,
    'estimated_value', l.estimated_value,
    'proposed_value', l.proposed_value,
    'proposal_sent_at', l.proposal_sent_at,
    'commercial_notes', l.commercial_notes,
    'lost_reason_id', l.lost_reason_id,
    'lost_reason_name', lr.name,
    'lost_notes', l.lost_notes,
    'created_at', to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'updated_at', to_char(l.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'closed_at', l.closed_at,
    'days_in_pipeline', extract(day from now() - l.created_at)::integer,
    'next_activity', (
      select json_build_object(
        'id', a.id, 'type', a.type, 'title', a.title,
        'due_at', a.due_at, 'status', a.status,
        'is_overdue', a.due_at < now()
      )
      from public.crm_activities a
      where a.lead_id = l.id and a.status = 'PENDING'
      order by a.due_at asc limit 1
    ),
    -- Sale fields (only populated when WON)
    'sale_id', s.id,
    'sale_code', s.sale_code,
    'sale_status', s.status,
    'sale_net_value', s.net_value,
    'sale_created_at', s.created_at
  ) into v_result
  from public.crm_leads l
  join public.people p on p.id = l.person_id
  join public.crm_pipeline_stages ps on ps.id = l.stage_id
  left join public.crm_lead_sources cs on cs.id = l.source_id
  left join public.courses crs on crs.id = l.course_interest_id
  left join public.profiles pr on pr.id = l.owner_user_id
  left join public.crm_lost_reasons lr on lr.id = l.lost_reason_id
  left join public.sales s on s.lead_id = l.id and s.status = 'CONFIRMED'
  where l.id = p_lead_id;

  return v_result;
end;
$$;

-- =========================================================================
-- 2. get_crm_lead_timeline — add LEAD_WON from audit_logs
-- =========================================================================
-- The current timeline builds events via CTE UNION ALL.
-- LEAD_LOST comes from crm_lead_stage_history where reason = 'Lead perdido'.
-- LEAD_WON is a STATUS change, not a stage change, so it comes from audit_logs.
-- No duplication risk: current timeline has no LEAD_WON union.

create or replace function public.get_crm_lead_timeline(
  p_lead_id uuid,
  p_page integer default 1,
  p_page_size integer default 50
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_user_id uuid;
  v_exists boolean;
  v_has_view_all boolean;
  v_offset integer;
  v_total bigint;
  v_data json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  select exists(select 1 from public.crm_leads where id = p_lead_id) into v_exists;
  if not v_exists then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  select owner_user_id into v_owner_user_id from public.crm_leads where id = p_lead_id;
  if v_owner_user_id is distinct from auth.uid() and not v_has_view_all then
    raise exception 'Not authorized to view this lead' using errcode = '42501';
  end if;

  -- Count
  with all_events as (
    select l.id as event_id, 'LEAD_CREATED' as event_type
    from public.crm_leads l where l.id = p_lead_id
    union all
    select sh.id, 'STAGE_CHANGED'
    from public.crm_lead_stage_history sh where sh.lead_id = p_lead_id
    union all
    select a.id, 'ACTIVITY_CREATED'
    from public.crm_activities a where a.lead_id = p_lead_id and a.status in ('PENDING','COMPLETED','CANCELED')
    union all
    select a.id, 'ACTIVITY_COMPLETED'
    from public.crm_activities a where a.lead_id = p_lead_id and a.status = 'COMPLETED' and a.completed_at is not null
    union all
    select al.id, 'ACTIVITY_RESCHEDULED'
    from public.audit_logs al where al.action = 'crm.activity_rescheduled' and al.metadata ->> 'lead_id' = p_lead_id::text
    union all
    select a.id, 'ACTIVITY_CANCELED'
    from public.crm_activities a where a.lead_id = p_lead_id and a.status = 'CANCELED' and a.updated_at is not null
    union all
    select sh.id, 'LEAD_LOST'
    from public.crm_lead_stage_history sh where sh.lead_id = p_lead_id and sh.reason = 'Lead perdido'
    union all
    select al.id, 'LEAD_WON'
    from public.audit_logs al where al.action = 'crm.lead_won' and al.entity_id = p_lead_id::text
  )
  select count(*) into v_total from all_events;

  -- Data
  with all_events as (
    select
      l.id as event_id, 'LEAD_CREATED' as event_type, l.created_at as occurred_at,
      'Lead criado' as title, null::text as description,
      l.created_by as actor_user_id, 'lead' as entity_type, l.id as entity_id,
      '{}'::jsonb as metadata
    from public.crm_leads l where l.id = p_lead_id

    union all

    select
      sh.id, 'STAGE_CHANGED', sh.changed_at,
      'Etapa alterada',
      (coalesce(ps.name,'(nenhuma)') || ' → ' || coalesce(ns.name,'(nenhuma)')),
      sh.changed_by, 'stage', sh.lead_id,
      jsonb_build_object('previous_stage_id',sh.previous_stage_id,'previous_stage_name',ps.name,'new_stage_id',sh.new_stage_id,'new_stage_name',ns.name,'reason',sh.reason)
    from public.crm_lead_stage_history sh
    left join public.crm_pipeline_stages ps on ps.id = sh.previous_stage_id
    left join public.crm_pipeline_stages ns on ns.id = sh.new_stage_id
    where sh.lead_id = p_lead_id

    union all

    select
      a.id, 'ACTIVITY_CREATED', a.created_at,
      'Atividade criada', a.title,
      a.created_by, 'activity', a.id,
      jsonb_build_object('type',a.type,'status',a.status)
    from public.crm_activities a where a.lead_id = p_lead_id and a.status in ('PENDING','COMPLETED','CANCELED')

    union all

    select
      a.id, 'ACTIVITY_COMPLETED', a.completed_at,
      'Atividade concluída', a.title,
      a.owner_user_id, 'activity', a.id,
      jsonb_build_object('type',a.type,'outcome',a.outcome)
    from public.crm_activities a where a.lead_id = p_lead_id and a.status = 'COMPLETED' and a.completed_at is not null

    union all

    select
      al.id, 'ACTIVITY_RESCHEDULED', al.created_at,
      'Atividade reagendada', null::text,
      al.actor_id, 'activity', null::uuid,
      al.metadata
    from public.audit_logs al where al.action = 'crm.activity_rescheduled' and al.metadata ->> 'lead_id' = p_lead_id::text

    union all

    select
      a.id, 'ACTIVITY_CANCELED', a.updated_at,
      'Atividade cancelada', a.title,
      a.updated_by, 'activity', a.id,
      jsonb_build_object('type',a.type)
    from public.crm_activities a where a.lead_id = p_lead_id and a.status = 'CANCELED' and a.updated_at is not null

    union all

    select
      sh.id, 'LEAD_LOST', sh.changed_at,
      'Lead perdido', sh.reason,
      sh.changed_by, 'lead', sh.lead_id,
      sh.metadata
    from public.crm_lead_stage_history sh where sh.lead_id = p_lead_id and sh.reason = 'Lead perdido'

    union all

    select
      al.id, 'LEAD_WON', al.created_at,
      'Venda fechada',
      al.metadata ->> 'sale_code',
      al.actor_id, 'sale', null::uuid,
      al.metadata
    from public.audit_logs al where al.action = 'crm.lead_won' and al.entity_id = p_lead_id::text
  )
  select json_agg(row_to_json(t)) into v_data
  from (
    select
      e.event_id as id, e.event_type, e.occurred_at, e.title, e.description,
      e.actor_user_id, pr.full_name as actor_name,
      e.entity_type, e.entity_id::text, e.metadata
    from all_events e
    left join public.profiles pr on pr.id = e.actor_user_id
    order by e.occurred_at desc
    limit greatest(p_page_size, 1)
    offset v_offset
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'total', v_total
  );
end;
$$;

commit;
