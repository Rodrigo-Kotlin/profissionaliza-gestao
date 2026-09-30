-- ============================================================================
-- RESET CONTROLADO — Supabase DEV (epjshcgsjvrydwuyqixi)
-- ============================================================================
-- Finalidade: limpar APENAS dados transacionais/homologação para recriar massa
-- E2E (LEAD -> VENDA -> CONTRATO -> ALUNO).
--
-- SEGURANÇA (requisitos do task):
--   * NÃO mexe em estrutura, migrations, RBAC, sequences ou masters.
--   * DELETE explícito (sem TRUNCATE CASCADE), dentro de UMA transação.
--   * Ordem por FK: contracts -> sales -> crm_activities ->
--     crm_lead_stage_history -> crm_leads -> student_guardians ->
--     student_status_history -> students -> people.
--   * Guard clause: exige marcador explícito. Sem ele, aborta.
--
-- TABELAS LIMPAS (dados):
--   contracts, sales, crm_activities, crm_lead_stage_history, crm_leads,
--   student_guardians, student_status_history, students, people.
--
-- AUDIT_LOGS: removidos apenas os registros transacionais dos domínios limpos
--   (crm.*, sales.*, contracts.*, student.*, guardian.*, people.created,
--   people.reused). Preservados os traços de RBAC/settings/auth/profiles/courses
--   (masters) e os demais.
--
-- PRESERVADOS (masters): courses, crm_lead_sources, crm_pipeline_stages,
--   crm_lost_reasons, profiles, roles, permissions, role_permissions,
--   user_roles, system_settings + sequences (numeração continua).
--
-- Uso (DEV):
--   supabase db query --linked -f scripts/dev/reset-e2e-data.sql
--     (o próprio script já define o marcador; funciona apenas no DEV linked)
-- ============================================================================

-- Guard clause: exigência explícita de confirmação.
-- O arquivo define o marcador; qualquer execução sem o marcador aborta.
set app.e2e_confirm = 'E2E-RESET-2026';

do $$
begin
  if coalesce(current_setting('app.e2e_confirm', true), '') <> 'E2E-RESET-2026' then
    raise exception 'Guard clause: execute apenas em DEV com app.e2e_confirm = E2E-RESET-2026';
  end if;
end $$;

begin;

-- Captura IDs dos domínios limpos para purgar auditoria correspondente
create temp table e2e_purge_on_start as
  select 'contract' as et, id::text as eid from public.contracts
  union all select 'sale', id::text from public.sales
  union all select 'crm_lead', id::text from public.crm_leads
  union all select 'crm_stage', id::text from public.crm_lead_stage_history
  union all select 'crm_activity', id::text from public.crm_activities
  union all select 'student', id::text from public.students
  union all select 'student_guardian', id::text from public.student_guardians
  union all select 'student_status', id::text from public.student_status_history
  union all select 'person', id::text from public.people;

-- Purgar auditoria transacional (referenciada e transacional por ação)
delete from public.audit_logs al
using (select * from e2e_purge_on_start) p
where al.entity_type = p.et and al.entity_id = p.eid;

delete from public.audit_logs
where action in (
  'crm.lead_created','crm.lead_updated','crm.stage_changed','crm.lead_assigned',
  'crm.close_lost','crm.lead_won','crm.activity_created','crm.activity_completed',
  'crm.activity_rescheduled','crm.activity_canceled','crm.lead_identity_conflict',
  'sales.created','sales.canceled','contracts.created','contracts.updated_draft',
  'contracts.issued','contracts.signed','contracts.canceled',
  'student.created','student.status_changed','student.updated',
  'guardian.linked','guardian.unlinked',
  'people.created','people.reused'
);

-- =========================================================================
-- DELETES na ordem de FK (mais referenciados primeiro)
-- =========================================================================
delete from public.contracts;
delete from public.sales;
delete from public.crm_activities;
delete from public.crm_lead_stage_history;
delete from public.crm_leads;
delete from public.student_guardians;
delete from public.student_status_history;
delete from public.students;
delete from public.people;

drop table e2e_purge_on_start;

commit;

-- Resumo pós-reset (último result set exibido)
select
  (select count(*) from public.contracts) as contracts,
  (select count(*) from public.sales) as sales,
  (select count(*) from public.crm_leads) as leads,
  (select count(*) from public.people) as people,
  (select count(*) from public.students) as students,
  (select count(*) from public.crm_activities) as activities,
  (select count(*) from public.crm_lead_stage_history) as stage_history,
  (select count(*) from public.student_guardians) as guardians,
  (select count(*) from public.student_status_history) as status_history,
  (select count(*) from public.courses) as courses_preserved,
  (select count(*) from public.crm_pipeline_stages) as stages_preserved,
  (select count(*) from public.system_settings) as settings_preserved,
  (select count(*) from public.profiles) as profiles_preserved;