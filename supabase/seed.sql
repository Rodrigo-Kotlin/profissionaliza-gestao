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
on conflict (code) do update set name = excluded.name, description = excluded.description, updated_at = now();

insert into public.permissions (code, name, description, module) values
  ('dashboard.view', 'Visualizar dashboard', 'Visualizar indicadores executivos.', 'dashboard'),
  ('crm.view', 'Visualizar CRM', 'Consultar leads e atendimentos.', 'crm'),
  ('crm.create', 'Criar no CRM', 'Criar leads e atendimentos.', 'crm'),
  ('crm.edit', 'Editar CRM', 'Editar leads e atendimentos.', 'crm'),
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
  ('reports.view', 'Visualizar relatórios', 'Consultar relatórios.', 'reports'),
  ('reports.export', 'Exportar relatórios', 'Exportar relatórios.', 'reports'),
  ('audit.view', 'Visualizar auditoria', 'Consultar trilhas de auditoria.', 'administration'),
  ('settings.view', 'Visualizar configurações', 'Consultar configurações.', 'administration'),
  ('settings.manage', 'Gerenciar configurações', 'Alterar configurações.', 'administration')
on conflict (code) do update set name = excluded.name, description = excluded.description, module = excluded.module, updated_at = now();

delete from public.role_permissions where role_id in (select id from public.roles where code in ('ADMIN','DIRECAO','GERENTE_COMERCIAL','VENDEDOR','FINANCEIRO','PEDAGOGICO','PROFESSOR','RECEPCAO'));

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'ADMIN'
on conflict do nothing;

with grants(role_code, permission_code) as (values
  ('DIRECAO','dashboard.view'),('DIRECAO','crm.view'),('DIRECAO','sales.view'),('DIRECAO','sales.approve'),('DIRECAO','finance.view'),('DIRECAO','finance.export'),('DIRECAO','academic.view'),('DIRECAO','commissions.view'),('DIRECAO','commissions.approve'),('DIRECAO','users.view'),('DIRECAO','reports.view'),('DIRECAO','reports.export'),('DIRECAO','audit.view'),('DIRECAO','settings.view'),
  ('GERENTE_COMERCIAL','dashboard.view'),('GERENTE_COMERCIAL','crm.view'),('GERENTE_COMERCIAL','crm.create'),('GERENTE_COMERCIAL','crm.edit'),('GERENTE_COMERCIAL','sales.view'),('GERENTE_COMERCIAL','sales.create'),('GERENTE_COMERCIAL','sales.approve'),('GERENTE_COMERCIAL','commissions.view'),('GERENTE_COMERCIAL','users.view'),('GERENTE_COMERCIAL','reports.view'),
  ('VENDEDOR','dashboard.view'),('VENDEDOR','crm.view'),('VENDEDOR','crm.create'),('VENDEDOR','crm.edit'),('VENDEDOR','sales.view'),('VENDEDOR','sales.create'),('VENDEDOR','commissions.view'),
  ('FINANCEIRO','dashboard.view'),('FINANCEIRO','finance.view'),('FINANCEIRO','finance.create'),('FINANCEIRO','finance.receive'),('FINANCEIRO','finance.export'),('FINANCEIRO','commissions.view'),('FINANCEIRO','reports.view'),('FINANCEIRO','reports.export'),('FINANCEIRO','users.view'),
  ('PEDAGOGICO','dashboard.view'),('PEDAGOGICO','academic.view'),('PEDAGOGICO','academic.manage'),('PEDAGOGICO','attendance.create'),('PEDAGOGICO','reports.view'),('PEDAGOGICO','users.view'),
  ('PROFESSOR','dashboard.view'),('PROFESSOR','academic.view'),('PROFESSOR','attendance.create'),
  ('RECEPCAO','dashboard.view'),('RECEPCAO','crm.view'),('RECEPCAO','crm.create'),('RECEPCAO','crm.edit'),('RECEPCAO','sales.view'),('RECEPCAO','academic.view')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from grants g join public.roles r on r.code = g.role_code join public.permissions p on p.code = g.permission_code
on conflict do nothing;

insert into public.system_settings (key, value, description, is_public) values
  ('organization.locale', '"pt-BR"'::jsonb, 'Localidade padrão da instituição.', true),
  ('organization.timezone', '"America/Santarem"'::jsonb, 'Fuso horário padrão.', true)
on conflict (key) do update set value = excluded.value, description = excluded.description, is_public = excluded.is_public, updated_at = now();

commit;
