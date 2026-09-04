-- ============================================================================
-- PHASE 2.2 — HOTFIX DE HOMOLOGAÇÃO #2 (PR #11)
-- 20260903130000_phase2_2_rpc_exposure_security_fixes.sql
--
-- 1. get_crm_lead_detail: adiciona validação de ownership antes de retornar PII.
--    - ADMIN/DIRECAO/GERENTE (crm.view_all): visualizam qualquer lead.
--    - VENDEDOR / RECEPCAO (crm.view apenas): somente lead onde
--      owner_user_id = auth.uid().
--    - Lead inexistente e lead sem autorização são separados (não vazam PII).
-- 2. Grants explícitos das RPCs da Fase 2.2 (sem depender de PUBLIC EXECUTE).
-- 3. Reload do schema cache do PostgREST.
--
-- NÃO altera migrations já aplicadas (20260903100000 / 20260903120000).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. get_crm_lead_detail — OWNERSHIP + separação de "não encontrado" vs "sem autorização"
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_crm_lead_detail(p_lead_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_owner_user_id uuid;
  v_status text;
  v_exists boolean;
  v_has_view_all boolean;
  v_lead json;
  v_next_activity json;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');

  -- 1) Checagem de existência SEM vazar PII.
  select exists(
    select 1 from public.crm_leads where id = p_lead_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  -- 2) Ownership: somente owner (owner_user_id = auth.uid()) ou quem tem
  --    crm.view_all pode visualizar detalhes (PII).
  select l.owner_user_id, l.status::text
  into v_owner_user_id, v_status
  from public.crm_leads l
  where l.id = p_lead_id;

  if v_owner_user_id is distinct from auth.uid() and not v_has_view_all then
    raise exception 'Not authorized to view this lead' using errcode = '42501';
  end if;

  -- 3) Monta o JSON de retorno (PII permitido aqui).
  select json_build_object(
    'id', l.id,
    'lead_code', l.lead_code,
    'person_id', l.person_id,
    'full_name', p.full_name,
    'phone', p.phone,
    'whatsapp', p.whatsapp,
    'email', p.email,
    'stage_id', l.stage_id,
    'stage_code', s.code,
    'stage_name', s.name,
    'source_id', l.source_id,
    'source_name', sr.name,
    'course_interest_id', l.course_interest_id,
    'course_name', c.name,
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
    'days_in_pipeline', extract(day from now() - l.created_at)::integer
  )
  into v_lead
  from public.crm_leads l
  join public.people p on p.id = l.person_id
  join public.crm_pipeline_stages s on s.id = l.stage_id
  left join public.crm_lead_sources sr on sr.id = l.source_id
  left join public.courses c on c.id = l.course_interest_id
  left join public.profiles pr on pr.id = l.owner_user_id
  left join public.crm_lost_reasons lr on lr.id = l.lost_reason_id
  where l.id = p_lead_id;

  -- Próxima atividade
  select json_build_object(
    'id', a.id,
    'type', a.type,
    'title', a.title,
    'due_at', to_char(a.due_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
    'status', a.status,
    'is_overdue', a.due_at < now()
  )
  into v_next_activity
  from public.crm_activities a
  where a.lead_id = p_lead_id and a.status = 'PENDING'
  order by a.due_at asc
  limit 1;

  v_result := v_lead || json_build_object('next_activity', v_next_activity);

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Grants explícitos — Fase 2.2 (sem depender de PUBLIC EXECUTE)
-- ---------------------------------------------------------------------------
-- CRM RPCs
GRANT EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,uuid,uuid,text,text,text,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_lead_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_crm_pipeline(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_crm_leads(text,text,uuid,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_crm_lead_stage(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_crm_lead(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_crm_lead_lost(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_crm_activity(uuid,text,text,timestamptz,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_crm_activity(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_crm_activity(uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_dashboard_kpis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_activity_agenda(uuid,integer,integer) TO authenticated;

-- Course RPCs
GRANT EXECUTE ON FUNCTION public.list_courses(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_course(text,text,text,text,text,integer,integer,text,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_course(uuid,text,text,text,text,integer,integer,text,numeric,text,text) TO authenticated;

-- Revoga PUBLIC/anon explicitamente (reforço — não depende de default)
REVOKE EXECUTE ON FUNCTION public.create_crm_lead(text,text,text,text,text,uuid,uuid,text,text,text,text,timestamptz) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_crm_lead_detail(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.list_crm_pipeline(uuid,integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.search_crm_leads(text,text,uuid,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.move_crm_lead_stage(uuid,uuid,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.assign_crm_lead(uuid,uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.close_crm_lead_lost(uuid,uuid,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.create_crm_activity(uuid,text,text,timestamptz,text,uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.complete_crm_activity(uuid,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.reschedule_crm_activity(uuid,timestamptz) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.crm_dashboard_kpis() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.crm_activity_agenda(uuid,integer,integer) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.list_courses(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.create_course(text,text,text,text,text,integer,integer,text,numeric,text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.update_course(uuid,text,text,text,text,integer,integer,text,numeric,text,text) FROM public, anon;

-- ---------------------------------------------------------------------------
-- 3. Reload do schema cache do PostgREST
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

commit;
