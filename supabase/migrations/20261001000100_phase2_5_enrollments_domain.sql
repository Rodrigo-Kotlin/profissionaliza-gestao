-- ============================================================================
-- FASE 2.5B — ENROLLMENTS DOMAIN
-- Schema, sequence, permissions, RBAC and RPC-only access.
-- ============================================================================

begin;

create sequence if not exists public.enrollment_code_seq as integer;
revoke all on sequence public.enrollment_code_seq from public, anon, authenticated;

create table if not exists public.enrollments (
  id                   uuid primary key default gen_random_uuid(),
  enrollment_code      text not null unique,
  student_id           uuid not null references public.students(id) on delete restrict,
  course_id            uuid not null references public.courses(id) on delete restrict,
  sale_id              uuid not null unique references public.sales(id) on delete restrict,
  contract_id          uuid not null unique references public.contracts(id) on delete restrict,
  status               text not null default 'PENDING',
  enrollment_date      timestamptz not null default now(),
  started_at           timestamptz,
  paused_at            timestamptz,
  completed_at         timestamptz,
  canceled_at          timestamptz,
  cancellation_reason  text,
  pause_reason         text,
  notes                text,
  created_by           uuid references auth.users(id) on delete set null,
  updated_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint enrollments_code_format check (enrollment_code ~ '^MAT-[0-9]{4}-[0-9]{6}$'),
  constraint enrollments_status_check check (status in ('PENDING','ACTIVE','PAUSED','COMPLETED','CANCELED')),
  constraint enrollments_cancellation_reason_length check (
    cancellation_reason is null or char_length(trim(cancellation_reason)) <= 2000
  ),
  constraint enrollments_pause_reason_length check (
    pause_reason is null or char_length(trim(pause_reason)) <= 2000
  ),
  constraint enrollments_status_coherence_check check (
    (status = 'PENDING'
      and started_at is null
      and completed_at is null
      and canceled_at is null
      and cancellation_reason is null
      and pause_reason is null)
    or
    (status = 'ACTIVE'
      and started_at is not null
      and completed_at is null
      and canceled_at is null
      and cancellation_reason is null
      and pause_reason is null)
    or
    (status = 'PAUSED'
      and started_at is not null
      and paused_at is not null
      and completed_at is null
      and canceled_at is null
      and cancellation_reason is null
      and pause_reason is not null
      and char_length(trim(pause_reason)) > 0)
    or
    (status = 'COMPLETED'
      and started_at is not null
      and completed_at is not null
      and canceled_at is null
      and cancellation_reason is null
      and pause_reason is null)
    or
    (status = 'CANCELED'
      and completed_at is null
      and canceled_at is not null
      and cancellation_reason is not null
      and char_length(trim(cancellation_reason)) > 0
      and pause_reason is null)
  )
);

create index if not exists enrollments_student_id_idx on public.enrollments(student_id);
create index if not exists enrollments_course_id_idx on public.enrollments(course_id);
create index if not exists enrollments_status_idx on public.enrollments(status);
create index if not exists enrollments_enrollment_date_idx on public.enrollments(enrollment_date desc);

drop trigger if exists enrollments_set_updated_at on public.enrollments;
create trigger enrollments_set_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

alter table public.enrollments enable row level security;
revoke all on table public.enrollments from public, anon, authenticated;

insert into public.permissions (code, name, description, module) values
  ('enrollments.view', 'Visualizar matrículas', 'Consultar matrículas no escopo permitido.', 'enrollments'),
  ('enrollments.view_all', 'Visualizar todas as matrículas', 'Consultar matrículas de todos os vendedores.', 'enrollments'),
  ('enrollments.create', 'Recuperar matrículas', 'Criar matrícula a partir de contrato assinado em operação administrativa.', 'enrollments'),
  ('enrollments.activate', 'Ativar matrículas', 'Transicionar matrícula para ativa.', 'enrollments'),
  ('enrollments.pause', 'Pausar matrículas', 'Pausar matrícula com justificativa.', 'enrollments'),
  ('enrollments.resume', 'Retomar matrículas', 'Retomar matrícula pausada.', 'enrollments'),
  ('enrollments.complete', 'Concluir matrículas', 'Concluir matrícula ativa.', 'enrollments'),
  ('enrollments.cancel', 'Cancelar matrículas', 'Cancelar matrícula com justificativa.', 'enrollments')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'ADMIN'
  and p.code in (
    'enrollments.view','enrollments.view_all','enrollments.create',
    'enrollments.activate','enrollments.pause','enrollments.resume',
    'enrollments.complete','enrollments.cancel'
  )
on conflict do nothing;

with grants(role_code, permission_code) as (values
  ('DIRECAO','enrollments.view'),('DIRECAO','enrollments.view_all'),('DIRECAO','enrollments.create'),
  ('DIRECAO','enrollments.activate'),('DIRECAO','enrollments.pause'),('DIRECAO','enrollments.resume'),
  ('DIRECAO','enrollments.complete'),('DIRECAO','enrollments.cancel'),
  ('GERENTE_COMERCIAL','enrollments.view'),('GERENTE_COMERCIAL','enrollments.view_all'),
  ('PEDAGOGICO','enrollments.view'),('PEDAGOGICO','enrollments.view_all'),
  ('PEDAGOGICO','enrollments.activate'),('PEDAGOGICO','enrollments.pause'),('PEDAGOGICO','enrollments.resume'),
  ('PEDAGOGICO','enrollments.complete'),('PEDAGOGICO','enrollments.cancel'),
  ('RECEPCAO','enrollments.view'),('RECEPCAO','enrollments.activate'),
  ('FINANCEIRO','enrollments.view'),
  ('VENDEDOR','enrollments.view')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

commit;
