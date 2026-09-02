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
  ('settings.manage', 'Gerenciar configurações', 'Alterar configurações.', 'administration'),
  ('people.view', 'Visualizar pessoas', 'Permissão estrutural. Acesso via domínio, não diretório global.', 'people'),
  ('people.create', 'Criar pessoas', 'Criar registros de identidade (via domínio).', 'people'),
  ('people.edit', 'Editar pessoas', 'Editar registros de identidade (via domínio).', 'people'),
  ('students.view', 'Visualizar alunos', 'Consultar alunos. Dados pessoais mascarados.', 'students'),
  ('students.create', 'Criar alunos', 'Criar alunos.', 'students'),
  ('students.edit', 'Editar alunos', 'Editar alunos.', 'students'),
  ('students.manage_status', 'Gerenciar status de aluno', 'Alterar o status do aluno.', 'students'),
  ('students.view_sensitive', 'Visualizar dados sensíveis de aluno', 'Acessar CPF/RG/telefone/whatsapp/email/endereço completos do aluno.', 'students'),
  ('guardians.view', 'Visualizar responsáveis', 'Consultar responsáveis de um aluno.', 'guardians'),
  ('guardians.manage', 'Gerenciar responsáveis', 'Vincular/editar/desvincular responsáveis de um aluno.', 'guardians')
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
  ('RECEPCAO','dashboard.view'),('RECEPCAO','crm.view'),('RECEPCAO','crm.create'),('RECEPCAO','crm.edit'),('RECEPCAO','sales.view'),('RECEPCAO','academic.view'),
  ('DIRECAO','people.view'),('DIRECAO','people.create'),('DIRECAO','people.edit'),('DIRECAO','students.view'),('DIRECAO','students.create'),('DIRECAO','students.edit'),('DIRECAO','students.manage_status'),('DIRECAO','students.view_sensitive'),('DIRECAO','guardians.view'),('DIRECAO','guardians.manage'),
  ('PEDAGOGICO','people.view'),('PEDAGOGICO','people.edit'),('PEDAGOGICO','students.view'),('PEDAGOGICO','students.create'),('PEDAGOGICO','students.edit'),('PEDAGOGICO','students.manage_status'),('PEDAGOGICO','guardians.view'),('PEDAGOGICO','guardians.manage'),
  ('RECEPCAO','people.view'),('RECEPCAO','people.edit'),('RECEPCAO','students.view'),('RECEPCAO','students.create'),('RECEPCAO','students.edit'),('RECEPCAO','guardians.view'),('RECEPCAO','guardians.manage'),
  ('VENDEDOR','people.view'),('VENDEDOR','students.view'),
  ('FINANCEIRO','people.view'),('FINANCEIRO','students.view'),('FINANCEIRO','guardians.view')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from grants g join public.roles r on r.code = g.role_code join public.permissions p on p.code = g.permission_code
on conflict do nothing;

insert into public.system_settings (key, value, description, is_public) values
  ('organization.locale', '"pt-BR"'::jsonb, 'Localidade padrão da instituição.', true),
  ('organization.timezone', '"America/Santarem"'::jsonb, 'Fuso horário padrão.', true)
on conflict (key) do update set value = excluded.value, description = excluded.description, is_public = excluded.is_public, updated_at = now();

-- ---------------------------------------------------------------------------
-- DADOS DE DEMONSTRAÇÃO (fictícios — nunca insert de dados reais)
-- ---------------------------------------------------------------------------
do $$
declare
  v_p1 uuid; v_p2 uuid; v_p3 uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid;
  v_g1 uuid; v_g2 uuid; v_g3 uuid;
begin
  -- Pessoas fictícias
  insert into public.people (full_name, preferred_name, cpf, email, phone, whatsapp, city, state, created_by)
  values ('Ana Exemplo da Silva', 'Ana', '11144477735', 'ana.exemplo@exemplo.com.br', '5593911112222', '5593911112222', 'Santarém', 'PA', null)
  returning id into v_p1;

  insert into public.people (full_name, cpf, email, phone, whatsapp, city, state, created_by)
  values ('Carlos Demonstração Souza', '52998224725', 'carlos.demo@exemplo.com.br', '5593922223333', '5593922223333', 'Santarém', 'PA', null)
  returning id into v_p2;

  insert into public.people (full_name, cpf, email, phone, whatsapp, city, state, created_by)
  values ('Marina Teste Oliveira', '00000000000', 'marina.teste@exemplo.com.br', '5593933334444', '5593933334444', 'Santarém', 'PA', null)
  returning id into v_p3;

  -- Alunos fictícios (código manual determinístico)
  insert into public.students (person_id, student_code, status, registration_date, origin, created_by)
  values (v_p1, 'ALU-2026-000001', 'ATIVO', current_date - interval '120 days', 'SITE', null)
  returning id into v_s1;

  insert into public.students (person_id, student_code, status, registration_date, origin, created_by)
  values (v_p2, 'ALU-2026-000002', 'ATIVO', current_date - interval '40 days', 'INSTAGRAM', null)
  returning id into v_s2;

  insert into public.students (person_id, student_code, status, registration_date, origin, created_by)
  values (v_p3, 'ALU-2026-000003', 'PRE_CADASTRO', current_date - interval '10 days', 'WHATSAPP', null)
  returning id into v_s3;

  -- Histórico inicial
  insert into public.student_status_history (student_id, previous_status, new_status, reason, changed_by)
  values
    (v_s1, null, 'ATIVO', 'Cadastro de demonstração', null),
    (v_s2, null, 'ATIVO', 'Cadastro de demonstração', null),
    (v_s3, null, 'PRE_CADASTRO', 'Cadastro de demonstração', null);

  -- Responsáveis fictícios (reutilizando people)
  insert into public.people (full_name, cpf, email, phone, whatsapp, created_by)
  values ('João Exemplo da Silva', '12345678909', 'joao.exemplo@exemplo.com.br', '5593911113333', '5593911113333', null)
  returning id into v_g1;

  insert into public.people (full_name, cpf, email, phone, whatsapp, created_by)
  values ('Fernanda Demonstração Souza', '98765432100', 'fernanda.demo@exemplo.com.br', '5593922224444', '5593922224444', null)
  returning id into v_g2;

  insert into public.people (full_name, cpf, email, phone, created_by)
  values ('Roberto Teste Oliveira', '00011122233', null, '5593933335555', null)
  returning id into v_g3;

  insert into public.student_guardians (student_id, guardian_person_id, relationship, is_primary_contact, is_financial_responsible, is_legal_guardian, created_by)
  values
    (v_s1, v_g1, 'PAI', true, true, true, null),
    (v_s2, v_g2, 'MAE', true, true, true, null),
    (v_s3, v_g3, 'RESPONSAVEL_LEGAL', true, true, true, null);
end $$;

commit;
