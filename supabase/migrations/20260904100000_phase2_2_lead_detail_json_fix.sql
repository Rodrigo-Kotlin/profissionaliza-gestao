-- ============================================================================
-- PHASE 2.2 — HOTFIX JSON CONCATENATION (PR #11 follow-up)
-- 20260904100000_phase2_2_lead_detail_json_fix.sql
--
-- Corrige 42883 / HTTP 404 em get_crm_lead_detail.
--
-- Causa: json || json não existe no PostgreSQL (apenas jsonb || jsonb).
-- PostgREST converte 42883 em 404.
--
-- Fix: cast v_lead para jsonb na concatenação final.
-- Retorna json (contrato da API inalterado).
-- NÃO altera ownership, PII ou permissions.
-- ============================================================================

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

  -- FIX: json || json não existe no PostgreSQL. Cast para jsonb para usar
  -- o operador ||, depois retorna como json (contrato da API inalterado).
  v_result := (
    v_lead::jsonb
    ||
    jsonb_build_object('next_activity', v_next_activity)
  )::json;

  return v_result;
end;
$$;

-- Reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
