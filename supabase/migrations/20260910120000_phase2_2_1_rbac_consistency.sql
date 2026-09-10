-- FASE 2.2.1: migrations are the source of truth for roles and permissions.
begin;

insert into public.roles (code, name, description) values
  ('ADMIN', 'Administrador', 'Acesso administrativo integral ao sistema.'),
  ('DIRECAO', 'Direção', 'Visão executiva e gestão institucional.'),
  ('GERENTE_COMERCIAL', 'Gerente Comercial', 'Gestão da operação comercial.'),
  ('VENDEDOR', 'Vendedor', 'Atendimento e operação de vendas.'),
  ('FINANCEIRO', 'Financeiro', 'Cobranças, recebimentos e gestão financeira.'),
  ('PEDAGOGICO', 'Pedagógico', 'Gestão acadêmica e pedagógica.'),
  ('PROFESSOR', 'Professor', 'Turmas, aulas e frequência.'),
  ('RECEPCAO', 'Recepção', 'Atendimento e apoio operacional.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

-- Permissions already introduced by phases 2.1 and 2.2 remain defined there.
-- This backfills the foundation/future catalog that previously existed only in seed.sql.
insert into public.permissions (code, name, description, module) values
  ('dashboard.view', 'Visualizar dashboard', 'Visualizar indicadores executivos.', 'dashboard'),
  ('sales.view', 'Visualizar vendas', 'Consultar vendas.', 'sales'),
  ('sales.create', 'Criar vendas', 'Registrar vendas.', 'sales'),
  ('sales.approve', 'Aprovar vendas', 'Aprovar operações de venda.', 'sales'),
  ('finance.view', 'Visualizar financeiro', 'Consultar dados financeiros.', 'finance'),
  ('finance.create', 'Criar lançamentos', 'Criar lançamentos financeiros.', 'finance'),
  ('finance.receive', 'Registrar recebimentos', 'Registrar recebimentos e baixas.', 'finance'),
  ('finance.export', 'Exportar financeiro', 'Exportar dados financeiros.', 'finance'),
  ('academic.view', 'Visualizar pedagógico', 'Consultar dados acadêmicos.', 'academic'),
  ('academic.manage', 'Gerenciar pedagógico', 'Administrar dados acadêmicos.', 'academic'),
  ('attendance.create', 'Registrar frequência', 'Criar e corrigir frequência.', 'academic'),
  ('commissions.view', 'Visualizar comissões', 'Consultar comissões.', 'commissions'),
  ('commissions.approve', 'Aprovar comissões', 'Aprovar comissões.', 'commissions'),
  ('users.view', 'Visualizar usuários', 'Consultar o diretório de usuários.', 'administration'),
  ('users.manage', 'Gerenciar usuários', 'Administrar usuários, papéis e permissões.', 'administration'),
  ('rbac.view', 'Visualizar papéis e permissões', 'Consultar a matriz de acesso.', 'administration'),
  ('reports.view', 'Visualizar relatórios', 'Consultar relatórios.', 'reports'),
  ('reports.export', 'Exportar relatórios', 'Exportar relatórios.', 'reports'),
  ('audit.view', 'Visualizar auditoria', 'Consultar trilhas de auditoria.', 'administration'),
  ('settings.view', 'Visualizar configurações', 'Consultar configurações.', 'administration'),
  ('settings.manage', 'Gerenciar configurações', 'Alterar configurações.', 'administration')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

-- ADMIN receives the complete current catalog. Future migrations must explicitly grant
-- newly introduced permissions, as phases 2.1 and 2.2 already do.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'ADMIN'
on conflict do nothing;

with grants(role_code, permission_code) as (values
  ('DIRECAO','dashboard.view'),('DIRECAO','crm.view'),('DIRECAO','crm.view_all'),('DIRECAO','crm.create'),('DIRECAO','crm.edit'),('DIRECAO','crm.assign'),('DIRECAO','crm.move_stage'),('DIRECAO','crm.close_lost'),('DIRECAO','crm.activities.manage'),('DIRECAO','crm.activities.manage_all'),('DIRECAO','crm.manage_catalog'),('DIRECAO','crm.reports'),('DIRECAO','courses.view'),('DIRECAO','courses.manage'),('DIRECAO','sales.view'),('DIRECAO','sales.approve'),('DIRECAO','finance.view'),('DIRECAO','finance.export'),('DIRECAO','academic.view'),('DIRECAO','commissions.view'),('DIRECAO','commissions.approve'),('DIRECAO','users.view'),('DIRECAO','reports.view'),('DIRECAO','reports.export'),('DIRECAO','audit.view'),('DIRECAO','settings.view'),
  ('DIRECAO','people.view'),('DIRECAO','people.create'),('DIRECAO','people.edit'),('DIRECAO','students.view'),('DIRECAO','students.create'),('DIRECAO','students.edit'),('DIRECAO','students.manage_status'),('DIRECAO','students.view_sensitive'),('DIRECAO','guardians.view'),('DIRECAO','guardians.manage'),
  ('GERENTE_COMERCIAL','dashboard.view'),('GERENTE_COMERCIAL','crm.view'),('GERENTE_COMERCIAL','crm.view_all'),('GERENTE_COMERCIAL','crm.create'),('GERENTE_COMERCIAL','crm.edit'),('GERENTE_COMERCIAL','crm.assign'),('GERENTE_COMERCIAL','crm.move_stage'),('GERENTE_COMERCIAL','crm.close_lost'),('GERENTE_COMERCIAL','crm.activities.manage'),('GERENTE_COMERCIAL','crm.activities.manage_all'),('GERENTE_COMERCIAL','crm.manage_catalog'),('GERENTE_COMERCIAL','crm.reports'),('GERENTE_COMERCIAL','courses.view'),('GERENTE_COMERCIAL','courses.manage'),('GERENTE_COMERCIAL','sales.view'),('GERENTE_COMERCIAL','sales.create'),('GERENTE_COMERCIAL','sales.approve'),('GERENTE_COMERCIAL','commissions.view'),('GERENTE_COMERCIAL','users.view'),('GERENTE_COMERCIAL','reports.view'),
  ('VENDEDOR','dashboard.view'),('VENDEDOR','crm.view'),('VENDEDOR','crm.create'),('VENDEDOR','crm.edit'),('VENDEDOR','crm.move_stage'),('VENDEDOR','crm.activities.manage'),('VENDEDOR','sales.view'),('VENDEDOR','sales.create'),('VENDEDOR','commissions.view'),('VENDEDOR','people.view'),('VENDEDOR','students.view'),
  ('FINANCEIRO','dashboard.view'),('FINANCEIRO','finance.view'),('FINANCEIRO','finance.create'),('FINANCEIRO','finance.receive'),('FINANCEIRO','finance.export'),('FINANCEIRO','commissions.view'),('FINANCEIRO','reports.view'),('FINANCEIRO','reports.export'),('FINANCEIRO','users.view'),('FINANCEIRO','people.view'),('FINANCEIRO','students.view'),('FINANCEIRO','guardians.view'),
  ('PEDAGOGICO','dashboard.view'),('PEDAGOGICO','academic.view'),('PEDAGOGICO','academic.manage'),('PEDAGOGICO','attendance.create'),('PEDAGOGICO','reports.view'),('PEDAGOGICO','users.view'),('PEDAGOGICO','courses.view'),('PEDAGOGICO','people.view'),('PEDAGOGICO','people.edit'),('PEDAGOGICO','students.view'),('PEDAGOGICO','students.create'),('PEDAGOGICO','students.edit'),('PEDAGOGICO','students.manage_status'),('PEDAGOGICO','guardians.view'),('PEDAGOGICO','guardians.manage'),
  ('PROFESSOR','dashboard.view'),('PROFESSOR','academic.view'),('PROFESSOR','attendance.create'),
  ('RECEPCAO','dashboard.view'),('RECEPCAO','crm.view'),('RECEPCAO','crm.create'),('RECEPCAO','sales.view'),('RECEPCAO','academic.view'),('RECEPCAO','people.view'),('RECEPCAO','people.edit'),('RECEPCAO','students.view'),('RECEPCAO','students.create'),('RECEPCAO','students.edit'),('RECEPCAO','guardians.view'),('RECEPCAO','guardians.manage')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

-- The old seed granted this capability contrary to the phase 2.2 role matrix.
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'RECEPCAO'
  and p.code = 'crm.edit';

commit;
