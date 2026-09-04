-- ============================================================================
-- FASE 2.2 — CRM COMERCIAL: PROSPECÇÃO, LEADS, PIPELINE, ATIVIDADES
-- ============================================================================
-- Princípio:
--   people = identidade central (uma pessoa pode ter N leads para cursos diferentes).
--   crm_leads = interesse/caso comercial (NÃO é cópia de people).
--   courses = entidade canônica de cursos (futuro pedagógico amplia esta tabela).
--
-- Segurança:
--   - RLS em todas as tabelas operacionais.
--   - people mantém proteção total (SELECT revocado).
--   - RPCs com SECURITY DEFINER + search_path explícito quando necessário.
--   - Ownership: vendedor só vê seus leads; gerente/direção vê todos.
--   - PII limitada a nome/telefone/whatsapp/email para quem tem acesso ao lead.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. PERMISSIONS — CRM e Cursos (fonte de evolução = MIGRATION)
-- ---------------------------------------------------------------------------
insert into public.permissions (code, name, description, module) values
  -- CRM
  ('crm.view', 'Visualizar CRM', 'Acessar módulo CRM e visualizar leads próprios.', 'crm'),
  ('crm.view_all', 'Visualizar todos os leads', 'Visualizar leads de toda a equipe.', 'crm'),
  ('crm.create', 'Criar leads', 'Criar novos leads no pipeline.', 'crm'),
  ('crm.edit', 'Editar leads', 'Editar informações de leads.', 'crm'),
  ('crm.assign', 'Reatribuir leads', 'Reatribuir leads a outros vendedores.', 'crm'),
  ('crm.move_stage', 'Mover leads no pipeline', 'Alterar a etapa de um lead no pipeline.', 'crm'),
  ('crm.close_lost', 'Fechar lead como perdido', 'Fechar um lead com motivo de perda.', 'crm'),
  ('crm.activities.manage', 'Gerenciar atividades próprias', 'Criar, concluir e reagendar atividades próprias.', 'crm'),
  ('crm.activities.manage_all', 'Gerenciar atividades da equipe', 'Gerenciar atividades de qualquer vendedor.', 'crm'),
  ('crm.manage_catalog', 'Gerenciar catálogo', 'Gerenciar catálogo de cursos e configurações CRM.', 'crm'),
  ('crm.reports', 'Relatórios CRM', 'Visualizar relatórios e indicadores do CRM.', 'crm'),
  -- Cursos (entidade institucional compartilhada)
  ('courses.view', 'Visualizar cursos', 'Consultar catálogo de cursos.', 'academic'),
  ('courses.manage', 'Gerenciar cursos', 'Criar, editar e gerenciar catálogo de cursos.', 'academic')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

-- Matriz de permissões por papel
with grants(role_code, permission_code) as (values
  -- ADMIN: todas (já tem todas via phase1, mas garantimos as novas)
  ('ADMIN','crm.view'),('ADMIN','crm.view_all'),('ADMIN','crm.create'),('ADMIN','crm.edit'),
  ('ADMIN','crm.assign'),('ADMIN','crm.move_stage'),('ADMIN','crm.close_lost'),
  ('ADMIN','crm.activities.manage'),('ADMIN','crm.activities.manage_all'),
  ('ADMIN','crm.manage_catalog'),('ADMIN','crm.reports'),
  ('ADMIN','courses.view'),('ADMIN','courses.manage'),

  -- DIRECAO: CRM completo + cursos
  ('DIRECAO','crm.view'),('DIRECAO','crm.view_all'),('DIRECAO','crm.create'),('DIRECAO','crm.edit'),
  ('DIRECAO','crm.assign'),('DIRECAO','crm.move_stage'),('DIRECAO','crm.close_lost'),
  ('DIRECAO','crm.activities.manage'),('DIRECAO','crm.activities.manage_all'),
  ('DIRECAO','crm.manage_catalog'),('DIRECAO','crm.reports'),
  ('DIRECAO','courses.view'),('DIRECAO','courses.manage'),

  -- GERENTE_COMERCIAL: CRM completo + catálogo + relatórios
  ('GERENTE_COMERCIAL','crm.view'),('GERENTE_COMERCIAL','crm.view_all'),
  ('GERENTE_COMERCIAL','crm.create'),('GERENTE_COMERCIAL','crm.edit'),
  ('GERENTE_COMERCIAL','crm.assign'),('GERENTE_COMERCIAL','crm.move_stage'),
  ('GERENTE_COMERCIAL','crm.close_lost'),
  ('GERENTE_COMERCIAL','crm.activities.manage'),('GERENTE_COMERCIAL','crm.activities.manage_all'),
  ('GERENTE_COMERCIAL','crm.manage_catalog'),('GERENTE_COMERCIAL','crm.reports'),
  ('GERENTE_COMERCIAL','courses.view'),('GERENTE_COMERCIAL','courses.manage'),

  -- VENDEDOR: CRUD próprio + atividades + movimentação
  ('VENDEDOR','crm.view'),('VENDEDOR','crm.create'),('VENDEDOR','crm.edit'),
  ('VENDEDOR','crm.move_stage'),('VENDEDOR','crm.activities.manage'),

  -- RECEPCAO: visualização e criação básica
  ('RECEPCAO','crm.view'),('RECEPCAO','crm.create'),

  -- PEDAGOGICO: apenas visualizar cursos
  ('PEDAGOGICO','courses.view')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. TABELA COURSES — Entidade canônica de cursos
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  short_name text,
  category text,
  modality text not null default 'PRESENCIAL',
  workload_hours integer,
  duration_value integer,
  duration_unit text,
  default_price numeric(12,2),
  description text,
  status text not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint courses_code_length check (char_length(code) between 1 and 20),
  constraint courses_name_length check (char_length(name) between 1 and 200),
  constraint courses_modality_check check (modality in ('PRESENCIAL','ONLINE','HIBRIDO')),
  constraint courses_status_check check (status in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED')),
  constraint courses_workload_check check (workload_hours is null or workload_hours > 0),
  constraint courses_duration_check check (duration_value is null or duration_value > 0),
  constraint courses_price_check check (default_price is null or default_price >= 0)
);

create index if not exists courses_status_idx on public.courses(status);
create index if not exists courses_category_idx on public.courses(category) where category is not null;

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. TABELA CRM_PIPELINE_STAGES — Etapas do pipeline
-- ---------------------------------------------------------------------------
create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  position integer not null,
  probability integer,
  is_active boolean not null default true,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_pipeline_stages_code_length check (char_length(code) between 1 and 40),
  constraint crm_pipeline_stages_name_length check (char_length(name) between 1 and 80),
  constraint crm_pipeline_stages_probability_check check (probability is null or (probability >= 0 and probability <= 100))
);

-- Seeds: 7 etapas do pipeline
insert into public.crm_pipeline_stages (code, name, position, probability) values
  ('PROSPECTING', 'Prospecção', 10, 5),
  ('NEW_LEAD', 'Novo Lead', 20, 10),
  ('CONTACT_STARTED', 'Contato Iniciado', 30, 25),
  ('QUALIFIED', 'Qualificado', 40, 50),
  ('IN_SERVICE', 'Em Atendimento', 50, 65),
  ('PROPOSAL_SENT', 'Proposta Enviada', 60, 80),
  ('NEGOTIATION', 'Negociação', 70, 90)
on conflict (code) do update set
  name = excluded.name,
  position = excluded.position,
  probability = excluded.probability,
  updated_at = now();

drop trigger if exists crm_pipeline_stages_set_updated_at on public.crm_pipeline_stages;
create trigger crm_pipeline_stages_set_updated_at before update on public.crm_pipeline_stages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. TABELA CRM_LEADSources — Fontes de lead
-- ---------------------------------------------------------------------------
create table if not exists public.crm_lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_lead_sources_code_length check (char_length(code) between 1 and 40),
  constraint crm_lead_sources_name_length check (char_length(name) between 1 and 80)
);

insert into public.crm_lead_sources (code, name) values
  ('WHATSAPP', 'WhatsApp'),
  ('INSTAGRAM', 'Instagram'),
  ('SITE', 'Site'),
  ('PRESENCIAL', 'Presencial'),
  ('INDICACAO', 'Indicação'),
  ('LIGACAO', 'Ligação'),
  ('CAMPANHA', 'Campanha'),
  ('PARCEIRO', 'Parceiro'),
  ('PROSPECCAO', 'Prospecção'),
  ('OUTRO', 'Outro')
on conflict (code) do update set name = excluded.name, updated_at = now();

drop trigger if exists crm_lead_sources_set_updated_at on public.crm_lead_sources;
create trigger crm_lead_sources_set_updated_at before update on public.crm_lead_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. TABELA CRM_LOST_REASONS — Motivos de perda
-- ---------------------------------------------------------------------------
create table if not exists public.crm_lost_reasons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_lost_reasons_code_length check (char_length(code) between 1 and 40),
  constraint crm_lost_reasons_name_length check (char_length(name) between 1 and 80)
);

insert into public.crm_lost_reasons (code, name) values
  ('PRICE', 'Preço'),
  ('NO_INTEREST', 'Sem interesse'),
  ('COMPETITOR', 'Escolheu concorrente'),
  ('NO_RESPONSE', 'Sem retorno'),
  ('SCHEDULE', 'Horário incompatível'),
  ('COURSE_UNAVAILABLE', 'Curso indisponível'),
  ('FINANCIAL_CONDITION', 'Condição financeira'),
  ('OTHER', 'Outro')
on conflict (code) do update set name = excluded.name, updated_at = now();

drop trigger if exists crm_lost_reasons_set_updated_at on public.crm_lost_reasons;
create trigger crm_lost_reasons_set_updated_at before update on public.crm_lost_reasons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. SEQUENCE PARA CÓDIGO DO LEAD (concorrente-seguro)
-- ---------------------------------------------------------------------------
create sequence if not exists public.lead_code_seq as integer;

-- ---------------------------------------------------------------------------
-- 7. TABELA CRM_LEADS — Leads comerciais
-- ---------------------------------------------------------------------------
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  lead_code text not null unique,
  person_id uuid not null references public.people(id),
  stage_id uuid not null references public.crm_pipeline_stages(id),
  source_id uuid references public.crm_lead_sources(id),
  course_interest_id uuid references public.courses(id),
  owner_user_id uuid not null references auth.users(id),
  status text not null default 'OPEN',
  temperature text,
  qualification_start_period text,
  preferred_shift text,
  preferred_modality text,
  budget_notes text,
  decision_maker text,
  source_detail text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  estimated_value numeric(12,2),
  proposed_value numeric(12,2),
  proposal_sent_at timestamptz,
  commercial_notes text,
  lost_reason_id uuid references public.crm_lost_reasons(id),
  lost_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint crm_leads_status_check check (status in ('OPEN','LOST','WON','ARCHIVED')),
  constraint crm_leads_temperature_check check (temperature is null or temperature in ('HOT','WARM','COLD')),
  constraint crm_leads_estimated_value_check check (estimated_value is null or estimated_value >= 0),
  constraint crm_leads_proposed_value_check check (proposed_value is null or proposed_value >= 0)
);

-- Nota: NÃO criar UNIQUE em person_id — uma pessoa pode ter N leads.

create index if not exists crm_leads_person_id_idx on public.crm_leads(person_id);
create index if not exists crm_leads_owner_user_id_idx on public.crm_leads(owner_user_id);
create index if not exists crm_leads_stage_id_idx on public.crm_leads(stage_id);
create index if not exists crm_leads_status_idx on public.crm_leads(status);
create index if not exists crm_leads_source_id_idx on public.crm_leads(source_id);
create index if not exists crm_leads_course_interest_id_idx on public.crm_leads(course_interest_id);
create index if not exists crm_leads_created_at_idx on public.crm_leads(created_at desc);
-- Índice composto para consultas de pipeline por owner + status
create index if not exists crm_leads_owner_status_stage_idx on public.crm_leads(owner_user_id, status, stage_id);
-- Lead code para busca
create index if not exists crm_leads_code_idx on public.crm_leads(lead_code);

drop trigger if exists crm_leads_set_updated_at on public.crm_leads;
create trigger crm_leads_set_updated_at before update on public.crm_leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. TABELA CRM_ACTIVITIES — Atividades por lead
-- ---------------------------------------------------------------------------
create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id),
  type text not null,
  title text not null,
  description text,
  due_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'PENDING',
  outcome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint crm_activities_type_check check (type in ('CALL','WHATSAPP','EMAIL','MEETING','FOLLOW_UP','OTHER')),
  constraint crm_activities_status_check check (status in ('PENDING','COMPLETED','CANCELED'))
);

-- Índices para consultas de agenda
create index if not exists crm_activities_lead_id_idx on public.crm_activities(lead_id);
create index if not exists crm_activities_owner_user_id_idx on public.crm_activities(owner_user_id);
create index if not exists crm_activities_due_at_idx on public.crm_activities(due_at);
-- Atividades pendentes por lead (próxima atividade)
create index if not exists crm_activities_pending_lead_idx on public.crm_activities(lead_id, due_at)
  where status = 'PENDING';
-- Atividades pendentes por owner (agenda do vendedor)
create index if not exists crm_activities_pending_owner_idx on public.crm_activities(owner_user_id, due_at)
  where status = 'PENDING';

drop trigger if exists crm_activities_set_updated_at on public.crm_activities;
create trigger crm_activities_set_updated_at before update on public.crm_activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. TABELA CRM_LEAD_STAGE_HISTORY — Histórico de movimentação
-- ---------------------------------------------------------------------------
create table if not exists public.crm_lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  previous_stage_id uuid,
  new_stage_id uuid not null references public.crm_pipeline_stages(id),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  reason text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists crm_lead_stage_history_lead_id_idx on public.crm_lead_stage_history(lead_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 10. RLS — Todas as tabelas operacionais
-- ---------------------------------------------------------------------------
alter table only public.courses enable row level security;
alter table only public.crm_pipeline_stages enable row level security;
alter table only public.crm_lead_sources enable row level security;
alter table only public.crm_lost_reasons enable row level security;
alter table only public.crm_leads enable row level security;
alter table only public.crm_activities enable row level security;
alter table only public.crm_lead_stage_history enable row level security;

-- Revogar acesso direto — tudo via RPCs controladas
revoke all on table public.courses from public, anon, authenticated;
revoke all on table public.crm_pipeline_stages from public, anon, authenticated;
revoke all on table public.crm_lead_sources from public, anon, authenticated;
revoke all on table public.crm_lost_reasons from public, anon, authenticated;
revoke all on table public.crm_leads from public, anon, authenticated;
revoke all on table public.crm_activities from public, anon, authenticated;
revoke all on table public.crm_lead_stage_history from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC — create_crm_lead (atômico: people + lead + stage history + audit)
-- ---------------------------------------------------------------------------
create or replace function public.create_crm_lead(
  p_full_name text,
  p_phone text default null,
  p_whatsapp text default null,
  p_email text default null,
  p_source_code text default 'OUTRO',
  p_course_interest_id uuid default null,
  p_owner_user_id uuid default null,
  p_temperature text default null,
  p_notes text default null,
  p_first_activity_title text default null,
  p_first_activity_type text default 'OTHER',
  p_first_activity_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person_id uuid;
  v_lead_id uuid;
  v_lead_code text;
  v_stage_id uuid;
  v_source_id uuid;
  v_owner uuid;
  v_normalized_phone text;
  v_normalized_whatsapp text;
  v_normalized_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.create') then
    raise exception 'Permission denied: crm.create' using errcode = '42501';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;

  if p_temperature is not null and p_temperature not in ('HOT','WARM','COLD') then
    raise exception 'Invalid temperature' using errcode = '22023';
  end if;

  -- Owner: validação
  v_owner := coalesce(p_owner_user_id, auth.uid());
  if v_owner <> auth.uid() and not public.has_permission('crm.assign') then
    raise exception 'Permission denied: crm.assign' using errcode = '42501';
  end if;
  -- Verificar se o owner existe
  if not exists (select 1 from public.profiles where id = v_owner and is_active) then
    raise exception 'Invalid owner user' using errcode = '22023';
  end if;

  -- Normalizações
  v_normalized_phone := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_normalized_whatsapp := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  -- Busca source
  select id into v_source_id from public.crm_lead_sources where code = p_source_code limit 1;

  -- Busca stage inicial (NEW_LEAD para leads inbound, PROSPECTING para prospecção)
  select id into v_stage_id from public.crm_pipeline_stages where code = 'NEW_LEAD';

  -- Procura pessoa existente por telefone/whatsapp/email (deduplicação por contato)
  if v_normalized_phone is not null or v_normalized_whatsapp is not null or v_normalized_email is not null then
    select id into v_person_id
    from public.people
    where (v_normalized_phone is not null and phone = v_normalized_phone)
       or (v_normalized_whatsapp is not null and whatsapp = v_normalized_whatsapp)
       or (v_normalized_email is not null and lower(email) = v_normalized_email)
    limit 1;
  end if;

  -- Cria pessoa se não encontrou
  if v_person_id is null then
    insert into public.people (
      full_name, phone, whatsapp, email, created_by, updated_by
    ) values (
      trim(p_full_name), v_normalized_phone, v_normalized_whatsapp, v_normalized_email,
      auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  -- Gera código do lead (concorrente-seguro via sequence)
  v_lead_code := 'LEAD-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.lead_code_seq')::text, 6, '0');

  -- Cria lead
  insert into public.crm_leads (
    lead_code, person_id, stage_id, source_id, course_interest_id,
    owner_user_id, status, temperature, notes,
    created_by, updated_by
  ) values (
    v_lead_code, v_person_id, v_stage_id, v_course_interest_id,
    nullif(v_course_interest_id, uuid(nil)),
    v_owner, 'OPEN', p_temperature,
    nullif(trim(coalesce(p_notes, '')), ''),
    auth.uid(), auth.uid()
  )
  returning id into v_lead_id;

  -- Histórico inicial
  insert into public.crm_lead_stage_history (lead_id, previous_stage_id, new_stage_id, changed_by, reason)
  values (v_lead_id, null, v_stage_id, auth.uid(), 'Criação do lead');

  -- Primeira atividade (opcional)
  if p_first_activity_title is not null and char_length(trim(p_first_activity_title)) > 0 and p_first_activity_due_at is not null then
    insert into public.crm_activities (
      lead_id, owner_user_id, type, title, due_at, status, created_by
    ) values (
      v_lead_id, v_owner, p_first_activity_type,
      trim(p_first_activity_title), p_first_activity_due_at, 'PENDING', auth.uid()
    );
  end if;

  -- Auditoria
  perform public.write_audit_log(
    'crm.lead_created', 'crm_lead', v_lead_id::text,
    jsonb_build_object('lead_code', v_lead_code, 'person_id', v_person_id::text, 'source', p_source_code)
  );

  return v_lead_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. RPC — update_crm_lead
-- ---------------------------------------------------------------------------
create or replace function public.update_crm_lead(
  p_lead_id uuid,
  p_source_id uuid default null,
  p_course_interest_id uuid default null,
  p_temperature text default null,
  p_notes text default null,
  p_qualification_start_period text default null,
  p_preferred_shift text default null,
  p_preferred_modality text default null,
  p_budget_notes text default null,
  p_decision_maker text default null,
  p_source_detail text default null,
  p_estimated_value numeric default null,
  p_proposed_value numeric default null,
  p_commercial_notes text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.edit') then
    raise exception 'Permission denied: crm.edit' using errcode = '42501';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  -- Ownership check: vendedor só edita seus leads
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.view_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;

  if v_lead.status <> 'OPEN' then
    raise exception 'Cannot edit closed lead' using errcode = '22023';
  end if;

  if p_temperature is not null and p_temperature not in ('HOT','WARM','COLD') then
    raise exception 'Invalid temperature' using errcode = '22023';
  end if;

  update public.crm_leads set
    source_id = coalesce(p_source_id, source_id),
    course_interest_id = coalesce(p_course_interest_id, course_interest_id),
    temperature = coalesce(p_temperature, temperature),
    qualification_start_period = coalesce(p_qualification_start_period, qualification_start_period),
    preferred_shift = coalesce(p_preferred_shift, preferred_shift),
    preferred_modality = coalesce(p_preferred_modality, preferred_modality),
    budget_notes = coalesce(p_budget_notes, budget_notes),
    decision_maker = coalesce(p_decision_maker, decision_maker),
    source_detail = coalesce(p_source_detail, source_detail),
    estimated_value = coalesce(p_estimated_value, estimated_value),
    proposed_value = coalesce(p_proposed_value, proposed_value),
    commercial_notes = coalesce(p_commercial_notes, commercial_notes),
    notes = coalesce(p_notes, notes),
    updated_by = auth.uid()
  where id = p_lead_id;

  perform public.write_audit_log(
    'crm.lead_updated', 'crm_lead', p_lead_id::text,
    jsonb_build_object('lead_code', v_lead.lead_code)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. RPC — get_crm_lead_detail (Lead 360)
-- ---------------------------------------------------------------------------
create or replace function public.get_crm_lead_detail(p_lead_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
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
    'notes', l.notes,
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

  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

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
-- 14. RPC — list_crm_pipeline (dados do Kanban com limite por coluna)
-- ---------------------------------------------------------------------------
create or replace function public.list_crm_pipeline(
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
        select json_agg(card order by l.created_at)
        from (
          select
            l.id,
            l.lead_code,
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
        ) l
      ), '[]'::json)
    ) as col
  ) col;

  return json_build_object('columns', v_columns);
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. RPC — search_crm_leads (listagem paginada com filtros)
-- ---------------------------------------------------------------------------
create or replace function public.search_crm_leads(
  p_query text default null,
  p_stage_code text default null,
  p_owner_user_id uuid default null,
  p_source_id uuid default null,
  p_course_interest_id uuid default null,
  p_temperature text default null,
  p_status text default 'OPEN',
  p_overdue_only boolean default false,
  p_no_activity boolean default false,
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'created_at',
  p_sort_dir text default 'DESC'
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_offset integer;
  v_has_view_all boolean;
  v_total bigint;
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  if p_page_size > 100 then
    raise exception 'page_size cannot exceed 100' using errcode = '22023';
  end if;

  select count(*)::bigint into v_total
  from public.crm_leads l
  join public.people p on p.id = l.person_id
  join public.crm_pipeline_stages st on st.id = l.stage_id
  left join public.crm_lead_sources sr on sr.id = l.source_id
  left join public.courses c on c.id = l.course_interest_id
  where (p_status is null or l.status = p_status)
    and (p_stage_code is null or st.code = p_stage_code)
    and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
    and (p_source_id is null or l.source_id = p_source_id)
    and (p_course_interest_id is null or l.course_interest_id = p_course_interest_id)
    and (p_temperature is null or l.temperature = p_temperature)
    and (v_has_view_all or l.owner_user_id = auth.uid())
    and (p_query is null or p_query = '' or
      l.lead_code ilike '%' || p_query || '%'
      or p.full_name ilike '%' || p_query || '%'
      or p.phone like p_query || '%'
      or p.whatsapp like p_query || '%'
    )
    and (not p_overdue_only or exists (
      select 1 from public.crm_activities a
      where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
    ))
    and (not p_no_activity or not exists (
      select 1 from public.crm_activities a
      where a.lead_id = l.id and a.status = 'PENDING'
    ));

  v_rows := coalesce(json_agg(row), '[]'::json)
  from (
    select
      l.id,
      l.lead_code,
      p.full_name,
      p.phone,
      p.whatsapp,
      st.code as stage_code,
      st.name as stage_name,
      sr.name as source_name,
      c.name as course_name,
      pr.full_name as owner_name,
      l.owner_user_id,
      l.temperature,
      l.status,
      l.created_at,
      l.updated_at,
      extract(day from now() - l.created_at)::int as days_in_pipeline,
      (select a.type || ': ' || a.title from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' order by a.due_at asc limit 1
      ) as next_activity_summary,
      (select a.due_at from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' order by a.due_at asc limit 1
      ) as next_activity_at,
      (select count(*)::int from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
      ) as overdue_count
    from public.crm_leads l
    join public.people p on p.id = l.person_id
    join public.crm_pipeline_stages st on st.id = l.stage_id
    left join public.crm_lead_sources sr on sr.id = l.source_id
    left join public.courses c on c.id = l.course_interest_id
    left join public.profiles pr on pr.id = l.owner_user_id
    where (p_status is null or l.status = p_status)
      and (p_stage_code is null or st.code = p_stage_code)
      and (p_owner_user_id is null or l.owner_user_id = p_owner_user_id)
      and (p_source_id is null or l.source_id = p_source_id)
      and (p_course_interest_id is null or l.course_interest_id = p_course_interest_id)
      and (p_temperature is null or l.temperature = p_temperature)
      and (v_has_view_all or l.owner_user_id = auth.uid())
      and (p_query is null or p_query = '' or
        l.lead_code ilike '%' || p_query || '%'
        or p.full_name ilike '%' || p_query || '%'
        or p.phone like p_query || '%'
        or p.whatsapp like p_query || '%'
      )
      and (not p_overdue_only or exists (
        select 1 from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING' and a.due_at < now()
      ))
      and (not p_no_activity or not exists (
        select 1 from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING'
      ))
    order by
      case when p_sort = 'lead_code' and upper(p_sort_dir) = 'DESC' then l.lead_code end desc,
      case when p_sort = 'lead_code' and upper(p_sort_dir) <> 'DESC' then l.lead_code end asc,
      case when p_sort = 'full_name' and upper(p_sort_dir) = 'DESC' then lower(p.full_name) end desc,
      case when p_sort = 'full_name' and upper(p_sort_dir) <> 'DESC' then lower(p.full_name) end asc,
      case when p_sort = 'stage' and upper(p_sort_dir) = 'DESC' then st.position end desc,
      case when p_sort = 'stage' and upper(p_sort_dir) <> 'DESC' then st.position end asc,
      case when upper(p_sort_dir) = 'DESC' then l.created_at end desc,
      case when upper(p_sort_dir) <> 'DESC' then l.created_at end asc
    limit p_page_size offset v_offset
  ) row;

  return json_build_object(
    'data', v_rows,
    'total', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. RPC — move_crm_lead_stage (atômico: move + history + audit)
-- ---------------------------------------------------------------------------
create or replace function public.move_crm_lead_stage(
  p_lead_id uuid,
  p_new_stage_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead record;
  v_new_stage record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.move_stage') then
    raise exception 'Permission denied: crm.move_stage' using errcode = '42501';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_lead.status <> 'OPEN' then
    raise exception 'Cannot move closed lead' using errcode = '22023';
  end if;

  -- Ownership check
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.view_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;

  select * into v_new_stage from public.crm_pipeline_stages where id = p_new_stage_id and is_active;
  if v_new_stage is null then
    raise exception 'Invalid or inactive stage' using errcode = '22023';
  end if;

  if v_lead.stage_id = p_new_stage_id then
    raise exception 'Lead is already in this stage' using errcode = '22023';
  end if;

  -- Validações por etapa
  if v_new_stage.code = 'QUALIFIED' then
    if v_lead.course_interest_id is null then
      raise exception 'Course interest is required to qualify a lead' using errcode = '22023';
    end if;
  end if;

  -- Atualiza lead
  update public.crm_leads set
    stage_id = p_new_stage_id,
    updated_by = auth.uid()
  where id = p_lead_id;

  -- Histórico
  insert into public.crm_lead_stage_history (lead_id, previous_stage_id, new_stage_id, changed_by, reason)
  values (p_lead_id, v_lead.stage_id, p_new_stage_id, auth.uid(), nullif(trim(coalesce(p_reason, '')), ''));

  -- Auditoria
  perform public.write_audit_log(
    'crm.stage_changed', 'crm_lead', p_lead_id::text,
    jsonb_build_object(
      'lead_code', v_lead.lead_code,
      'previous_stage', (select code from public.crm_pipeline_stages where id = v_lead.stage_id),
      'new_stage', v_new_stage.code
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. RPC — assign_crm_lead
-- ---------------------------------------------------------------------------
create or replace function public.assign_crm_lead(
  p_lead_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead record;
  v_new_owner_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.assign') then
    raise exception 'Permission denied: crm.assign' using errcode = '42501';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_lead.status <> 'OPEN' then
    raise exception 'Cannot reassign closed lead' using errcode = '22023';
  end if;

  select full_name into v_new_owner_name from public.profiles where id = p_new_owner_id and is_active;
  if v_new_owner_name is null then
    raise exception 'Invalid target user' using errcode = '22023';
  end if;

  update public.crm_leads set
    owner_user_id = p_new_owner_id,
    updated_by = auth.uid()
  where id = p_lead_id;

  perform public.write_audit_log(
    'crm.lead_assigned', 'crm_lead', p_lead_id::text,
    jsonb_build_object('lead_code', v_lead.lead_code, 'new_owner', v_new_owner_name)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 18. RPC — close_crm_lead_lost (atômico: lost + cancel activities + history + audit)
-- ---------------------------------------------------------------------------
create or replace function public.close_crm_lead_lost(
  p_lead_id uuid,
  p_lost_reason_id uuid,
  p_lost_notes text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_lead record;
  v_reason_code text;
  v_cancelled_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.close_lost') then
    raise exception 'Permission denied: crm.close_lost' using errcode = '42501';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id for update;
  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_lead.status <> 'OPEN' then
    raise exception 'Lead is not open' using errcode = '22023';
  end if;

  -- Ownership check
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.view_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;

  -- Valida motivo
  if p_lost_reason_id is null then
    raise exception 'Lost reason is required' using errcode = '22023';
  end if;

  select code into v_reason_code from public.crm_lost_reasons where id = p_lost_reason_id;
  if v_reason_code is null then
    raise exception 'Invalid lost reason' using errcode = '22023';
  end if;

  if v_reason_code = 'OTHER' and (p_lost_notes is null or char_length(trim(p_lost_notes)) = 0) then
    raise exception 'Lost notes are required when reason is OTHER' using errcode = '22023';
  end if;

  -- Atualiza lead
  update public.crm_leads set
    status = 'LOST',
    lost_reason_id = p_lost_reason_id,
    lost_notes = nullif(trim(coalesce(p_lost_notes, '')), ''),
    closed_at = now(),
    updated_by = auth.uid()
  where id = p_lead_id;

  -- Cancela atividades PENDING futuras
  update public.crm_activities set
    status = 'CANCELED',
    updated_by = auth.uid()
  where lead_id = p_lead_id
    and status = 'PENDING'
    and due_at >= now();

  get diagnostics v_cancelled_count = row_count;

  -- Histórico
  insert into public.crm_lead_stage_history (lead_id, previous_stage_id, new_stage_id, changed_by, reason, metadata)
  values (p_lead_id, v_lead.stage_id, v_lead.stage_id, auth.uid(), 'Lead perdido',
    jsonb_build_object('lost_reason', v_reason_code, 'cancelled_activities', v_cancelled_count));

  -- Auditoria
  perform public.write_audit_log(
    'crm.lead_lost', 'crm_lead', p_lead_id::text,
    jsonb_build_object('lead_code', v_lead.lead_code, 'lost_reason', v_reason_code, 'cancelled_activities', v_cancelled_count)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 19. RPC — create_crm_activity
-- ---------------------------------------------------------------------------
create or replace function public.create_crm_activity(
  p_lead_id uuid,
  p_type text,
  p_title text,
  p_due_at timestamptz,
  p_description text default null,
  p_owner_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_activity_id uuid;
  v_owner uuid;
  v_lead record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.activities.manage') then
    raise exception 'Permission denied: crm.activities.manage' using errcode = '42501';
  end if;

  select * into v_lead from public.crm_leads where id = p_lead_id;
  if v_lead is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if v_lead.status <> 'OPEN' then
    raise exception 'Cannot create activity for closed lead' using errcode = '22023';
  end if;

  -- Ownership check
  if v_lead.owner_user_id <> auth.uid() and not public.has_permission('crm.activities.manage_all') then
    raise exception 'Permission denied: not lead owner' using errcode = '42501';
  end if;

  if p_type not in ('CALL','WHATSAPP','EMAIL','MEETING','FOLLOW_UP','OTHER') then
    raise exception 'Invalid activity type' using errcode = '22023';
  end if;

  v_owner := coalesce(p_owner_user_id, auth.uid());

  insert into public.crm_activities (
    lead_id, owner_user_id, type, title, description, due_at, status, created_by
  ) values (
    p_lead_id, v_owner, p_type, trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_due_at, 'PENDING', auth.uid()
  )
  returning id into v_activity_id;

  perform public.write_audit_log(
    'crm.activity_created', 'crm_activity', v_activity_id::text,
    jsonb_build_object('lead_id', p_lead_id::text, 'type', p_type, 'title', p_title)
  );

  return v_activity_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 20. RPC — complete_crm_activity
-- ---------------------------------------------------------------------------
create or replace function public.complete_crm_activity(
  p_activity_id uuid,
  p_outcome text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_activity record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.activities.manage') then
    raise exception 'Permission denied: crm.activities.manage' using errcode = '42501';
  end if;

  select * into v_activity from public.crm_activities where id = p_activity_id for update;
  if v_activity is null then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  -- Ownership check
  if v_activity.owner_user_id <> auth.uid() and not public.has_permission('crm.activities.manage_all') then
    raise exception 'Permission denied: not activity owner' using errcode = '42501';
  end if;

  if v_activity.status <> 'PENDING' then
    raise exception 'Activity is not pending' using errcode = '22023';
  end if;

  update public.crm_activities set
    status = 'COMPLETED',
    completed_at = now(),
    outcome = nullif(trim(coalesce(p_outcome, '')), ''),
    updated_by = auth.uid()
  where id = p_activity_id;

  perform public.write_audit_log(
    'crm.activity_completed', 'crm_activity', p_activity_id::text,
    jsonb_build_object('lead_id', v_activity.lead_id::text, 'type', v_activity.type, 'has_outcome', (coalesce(p_outcome, '') <> ''))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 21. RPC — reschedule_crm_activity
-- ---------------------------------------------------------------------------
create or replace function public.reschedule_crm_activity(
  p_activity_id uuid,
  p_new_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_activity record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.activities.manage') then
    raise exception 'Permission denied: crm.activities.manage' using errcode = '42501';
  end if;

  select * into v_activity from public.crm_activities where id = p_activity_id for update;
  if v_activity is null then
    raise exception 'Activity not found' using errcode = 'P0002';
  end if;

  if v_activity.owner_user_id <> auth.uid() and not public.has_permission('crm.activities.manage_all') then
    raise exception 'Permission denied: not activity owner' using errcode = '42501';
  end if;

  if v_activity.status <> 'PENDING' then
    raise exception 'Activity is not pending' using errcode = '22023';
  end if;

  if p_new_due_at is null or p_new_due_at < now() then
    raise exception 'New due date must be in the future' using errcode = '22023';
  end if;

  update public.crm_activities set
    due_at = p_new_due_at,
    updated_by = auth.uid()
  where id = p_activity_id;

  perform public.write_audit_log(
    'crm.activity_rescheduled', 'crm_activity', p_activity_id::text,
    jsonb_build_object('lead_id', v_activity.lead_id::text, 'type', v_activity.type)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 22. RPC — crm_dashboard_kpis (métricas reais)
-- ---------------------------------------------------------------------------
create or replace function public.crm_dashboard_kpis()
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_new_leads bigint;
  v_open_leads bigint;
  v_qualified bigint;
  v_negotiation bigint;
  v_overdue_activities bigint;
  v_no_next_action bigint;
  v_total_leads bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('crm.view_all');

  select count(*) into v_new_leads from public.crm_leads l
    join public.crm_pipeline_stages st on st.id = l.stage_id
    where l.status = 'OPEN' and st.code in ('NEW_LEAD','PROSPECTING')
      and (v_has_view_all or l.owner_user_id = auth.uid());

  select count(*) into v_open_leads from public.crm_leads l
    where l.status = 'OPEN'
      and (v_has_view_all or l.owner_user_id = auth.uid());

  select count(*) into v_qualified from public.crm_leads l
    join public.crm_pipeline_stages st on st.id = l.stage_id
    where l.status = 'OPEN' and st.code in ('QUALIFIED','IN_SERVICE','PROPOSAL_SENT','NEGOTIATION')
      and (v_has_view_all or l.owner_user_id = auth.uid());

  select count(*) into v_negotiation from public.crm_leads l
    join public.crm_pipeline_stages st on st.id = l.stage_id
    where l.status = 'OPEN' and st.code = 'NEGOTIATION'
      and (v_has_view_all or l.owner_user_id = auth.uid());

  select count(*) into v_overdue_activities from public.crm_activities a
    join public.crm_leads l on l.id = a.lead_id
    where a.status = 'PENDING' and a.due_at < now()
      and l.status = 'OPEN'
      and (v_has_view_all or a.owner_user_id = auth.uid());

  select count(*) into v_no_next_action from public.crm_leads l
    where l.status = 'OPEN'
      and (v_has_view_all or l.owner_user_id = auth.uid())
      and not exists (
        select 1 from public.crm_activities a
        where a.lead_id = l.id and a.status = 'PENDING'
      );

  select count(*) into v_total_leads from public.crm_leads l
    where l.status = 'OPEN'
      and (v_has_view_all or l.owner_user_id = auth.uid());

  return json_build_object(
    'new_leads', v_new_leads,
    'open_leads', v_open_leads,
    'qualified', v_qualified,
    'negotiation', v_negotiation,
    'overdue_activities', v_overdue_activities,
    'no_next_action', v_no_next_action,
    'qualification_rate', case when v_open_leads > 0 then round(v_qualified::numeric / v_open_leads * 100, 1) else 0 end,
    'total_leads', v_total_leads
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 23. RPC — crm_activity_agenda (agenda do vendedor)
-- ---------------------------------------------------------------------------
create or replace function public.crm_activity_agenda(
  p_owner_user_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_offset integer;
  v_has_manage_all boolean;
  v_total bigint;
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('crm.view') then
    raise exception 'Permission denied: crm.view' using errcode = '42501';
  end if;

  v_has_manage_all := public.has_permission('crm.activities.manage_all');
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  select count(*)::bigint into v_total
  from public.crm_activities a
  join public.crm_leads l on l.id = a.lead_id
  where a.status = 'PENDING'
    and (v_has_manage_all or a.owner_user_id = auth.uid())
    and (p_owner_user_id is null or a.owner_user_id = p_owner_user_id);

  v_rows := coalesce(json_agg(row), '[]'::json)
  from (
    select
      a.id,
      a.lead_id,
      l.lead_code,
      p.full_name as lead_name,
      a.type,
      a.title,
      a.description,
      a.due_at,
      a.status,
      pr.full_name as owner_name,
      a.owner_user_id,
      a.due_at < now() as is_overdue
    from public.crm_activities a
    join public.crm_leads l on l.id = a.lead_id
    join public.people p on p.id = l.person_id
    left join public.profiles pr on pr.id = a.owner_user_id
    where a.status = 'PENDING'
      and (v_has_manage_all or a.owner_user_id = auth.uid())
      and (p_owner_user_id is null or a.owner_user_id = p_owner_user_id)
    order by
      case when a.due_at < now() then 0 else 1 end,
      a.due_at asc
    limit p_page_size offset v_offset
  ) row;

  return json_build_object(
    'data', v_rows,
    'total', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 24. RPC — list_courses (catálogo de cursos)
-- ---------------------------------------------------------------------------
create or replace function public.list_courses(
  p_status text default 'ACTIVE'
)
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

  v_rows := coalesce(json_agg(row order by c.name), '[]'::json)
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
      c.status
    from public.courses c
    where (p_status is null or c.status = p_status)
    order by c.name
  ) c;

  return v_rows;
end;
$$;

-- ---------------------------------------------------------------------------
-- 25. RPC — create_course (catálogo)
-- ---------------------------------------------------------------------------
create or replace function public.create_course(
  p_code text,
  p_name text,
  p_short_name text default null,
  p_category text default null,
  p_modality text default 'PRESENCIAL',
  p_workload_hours integer default null,
  p_duration_value integer default null,
  p_duration_unit text default null,
  p_default_price numeric default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_course_id uuid;
  v_normalized_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('courses.manage') then
    raise exception 'Permission denied: courses.manage' using errcode = '42501';
  end if;

  v_normalized_code := upper(trim(p_code));
  if v_normalized_code is null or char_length(v_normalized_code) = 0 then
    raise exception 'Course code is required' using errcode = '22023';
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'Course name is required' using errcode = '22023';
  end if;

  if p_modality not in ('PRESENCIAL','ONLINE','HIBRIDO') then
    raise exception 'Invalid modality' using errcode = '22023';
  end if;

  insert into public.courses (
    code, name, short_name, category, modality,
    workload_hours, duration_value, duration_unit,
    default_price, description, created_by, updated_by
  ) values (
    v_normalized_code, trim(p_name),
    nullif(trim(coalesce(p_short_name, '')), ''),
    nullif(trim(coalesce(p_category, '')), ''),
    p_modality,
    p_workload_hours, p_duration_value,
    nullif(trim(coalesce(p_duration_unit, '')), ''),
    p_default_price,
    nullif(trim(coalesce(p_description, '')), ''),
    auth.uid(), auth.uid()
  )
  returning id into v_course_id;

  perform public.write_audit_log(
    'crm.course_created', 'course', v_course_id::text,
    jsonb_build_object('code', v_normalized_code, 'name', p_name)
  );

  return v_course_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 26. RPC — update_course
-- ---------------------------------------------------------------------------
create or replace function public.update_course(
  p_course_id uuid,
  p_name text default null,
  p_short_name text default null,
  p_category text default null,
  p_modality text default null,
  p_workload_hours integer default null,
  p_duration_value integer default null,
  p_duration_unit text default null,
  p_default_price numeric default null,
  p_description text default null,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('courses.manage') then
    raise exception 'Permission denied: courses.manage' using errcode = '42501';
  end if;

  if not exists (select 1 from public.courses where id = p_course_id) then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  if p_status is not null and p_status not in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED') then
    raise exception 'Invalid course status' using errcode = '22023';
  end if;

  update public.courses set
    name = coalesce(p_name, name),
    short_name = coalesce(p_short_name, short_name),
    category = coalesce(p_category, category),
    modality = coalesce(p_modality, modality),
    workload_hours = coalesce(p_workload_hours, workload_hours),
    duration_value = coalesce(p_duration_value, duration_value),
    duration_unit = coalesce(p_duration_unit, duration_unit),
    default_price = coalesce(p_default_price, default_price),
    description = coalesce(p_description, description),
    status = coalesce(p_status, status),
    updated_by = auth.uid()
  where id = p_course_id;

  perform public.write_audit_log(
    'crm.course_updated', 'course', p_course_id::text,
    jsonb_build_object()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 27. GRANTS DAS RPCs
-- ---------------------------------------------------------------------------
-- CRM RPCs
grant execute on function public.create_crm_lead(text,text,text,text,text,uuid,uuid,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric,text) to authenticated;
grant execute on function public.get_crm_lead_detail(uuid) to authenticated;
grant execute on function public.list_crm_pipeline(uuid,integer) to authenticated;
grant execute on function public.search_crm_leads(text,text,uuid,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text) to authenticated;
grant execute on function public.move_crm_lead_stage(uuid,uuid,text) to authenticated;
grant execute on function public.assign_crm_lead(uuid,uuid) to authenticated;
grant execute on function public.close_crm_lead_lost(uuid,uuid,text) to authenticated;
grant execute on function public.create_crm_activity(uuid,text,text,timestamptz,text,uuid) to authenticated;
grant execute on function public.complete_crm_activity(uuid,text) to authenticated;
grant execute on function public.reschedule_crm_activity(uuid,timestamptz) to authenticated;
grant execute on function public.crm_dashboard_kpis() to authenticated;
grant execute on function public.crm_activity_agenda(uuid,integer,integer) to authenticated;
-- Course RPCs
grant execute on function public.list_courses(text) to authenticated;
grant execute on function public.create_course(text,text,text,text,text,integer,integer,text,numeric,text) to authenticated;
grant execute on function public.update_course(uuid,text,text,text,text,integer,integer,text,numeric,text,text) to authenticated;

-- Revoke from public/anon
revoke execute on function public.create_crm_lead(text,text,text,text,text,uuid,uuid,text,text,text,text,timestamptz) from public, anon;
revoke execute on function public.update_crm_lead(uuid,uuid,uuid,text,text,text,text,text,text,text,text,numeric,numeric,text) from public, anon;
revoke execute on function public.get_crm_lead_detail(uuid) from public, anon;
revoke execute on function public.list_crm_pipeline(uuid,integer) from public, anon;
revoke execute on function public.search_crm_leads(text,text,uuid,uuid,uuid,text,text,boolean,boolean,integer,integer,text,text) from public, anon;
revoke execute on function public.move_crm_lead_stage(uuid,uuid,text) from public, anon;
revoke execute on function public.assign_crm_lead(uuid,uuid) from public, anon;
revoke execute on function public.close_crm_lead_lost(uuid,uuid,text) from public, anon;
revoke execute on function public.create_crm_activity(uuid,text,text,timestamptz,text,uuid) from public, anon;
revoke execute on function public.complete_crm_activity(uuid,text) from public, anon;
revoke execute on function public.reschedule_crm_activity(uuid,timestamptz) from public, anon;
revoke execute on function public.crm_dashboard_kpis() from public, anon;
revoke execute on function public.crm_activity_agenda(uuid,integer,integer) from public, anon;
revoke execute on function public.list_courses(text) from public, anon;
revoke execute on function public.create_course(text,text,text,text,text,integer,integer,text,numeric,text) from public, anon;
revoke execute on function public.update_course(uuid,text,text,text,text,integer,integer,text,numeric,text,text) from public, anon;

commit;
