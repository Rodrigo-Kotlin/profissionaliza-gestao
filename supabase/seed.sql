begin;

-- Roles, permissions and role_permissions are owned exclusively by migrations.
-- This seed contains only idempotent development/demo data.

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
  on conflict (cpf) where cpf is not null do update set full_name = excluded.full_name, preferred_name = excluded.preferred_name, updated_at = now()
  returning id into v_p1;

  insert into public.people (full_name, cpf, email, phone, whatsapp, city, state, created_by)
  values ('Carlos Demonstração Souza', '52998224725', 'carlos.demo@exemplo.com.br', '5593922223333', '5593922223333', 'Santarém', 'PA', null)
  on conflict (cpf) where cpf is not null do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_p2;

  insert into public.people (full_name, cpf, email, phone, whatsapp, city, state, created_by)
  values ('Marina Teste Oliveira', '00000000000', 'marina.teste@exemplo.com.br', '5593933334444', '5593933334444', 'Santarém', 'PA', null)
  on conflict (cpf) where cpf is not null do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_p3;

  -- Alunos fictícios (código manual determinístico)
  insert into public.students (person_id, student_code, status, registration_date, origin, created_by)
  values (v_p1, 'ALU-2026-000001', 'ATIVO', current_date - interval '120 days', 'SITE', null)
  on conflict (student_code) do update set person_id = excluded.person_id, status = excluded.status, registration_date = excluded.registration_date, origin = excluded.origin, updated_at = now()
  returning id into v_s1;

  insert into public.students (person_id, student_code, status, registration_date, origin, created_by)
  values (v_p2, 'ALU-2026-000002', 'ATIVO', current_date - interval '40 days', 'INSTAGRAM', null)
  on conflict (student_code) do update set person_id = excluded.person_id, status = excluded.status, registration_date = excluded.registration_date, origin = excluded.origin, updated_at = now()
  returning id into v_s2;

  insert into public.students (person_id, student_code, status, registration_date, origin, created_by)
  values (v_p3, 'ALU-2026-000003', 'PRE_CADASTRO', current_date - interval '10 days', 'WHATSAPP', null)
  on conflict (student_code) do update set person_id = excluded.person_id, status = excluded.status, registration_date = excluded.registration_date, origin = excluded.origin, updated_at = now()
  returning id into v_s3;

  -- Histórico inicial
  insert into public.student_status_history (student_id, previous_status, new_status, reason, changed_by)
  select x.student_id, null, x.new_status, 'Cadastro de demonstração', null
  from (values (v_s1, 'ATIVO'), (v_s2, 'ATIVO'), (v_s3, 'PRE_CADASTRO')) as x(student_id, new_status)
  where not exists (
    select 1 from public.student_status_history h
    where h.student_id = x.student_id and h.previous_status is null and h.new_status = x.new_status and h.reason = 'Cadastro de demonstração'
  );

  -- Responsáveis fictícios (reutilizando people)
  insert into public.people (full_name, cpf, email, phone, whatsapp, created_by)
  values ('João Exemplo da Silva', '12345678909', 'joao.exemplo@exemplo.com.br', '5593911113333', '5593911113333', null)
  on conflict (cpf) where cpf is not null do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_g1;

  insert into public.people (full_name, cpf, email, phone, whatsapp, created_by)
  values ('Fernanda Demonstração Souza', '98765432100', 'fernanda.demo@exemplo.com.br', '5593922224444', '5593922224444', null)
  on conflict (cpf) where cpf is not null do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_g2;

  insert into public.people (full_name, cpf, email, phone, created_by)
  values ('Roberto Teste Oliveira', '00011122233', null, '5593933335555', null)
  on conflict (cpf) where cpf is not null do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_g3;

  insert into public.student_guardians (student_id, guardian_person_id, relationship, is_primary_contact, is_financial_responsible, is_legal_guardian, created_by)
  values
    (v_s1, v_g1, 'PAI', true, true, true, null),
    (v_s2, v_g2, 'MAE', true, true, true, null),
    (v_s3, v_g3, 'RESPONSAVEL_LEGAL', true, true, true, null)
  on conflict (student_id, guardian_person_id) do update set
    relationship = excluded.relationship,
    is_primary_contact = excluded.is_primary_contact,
    is_financial_responsible = excluded.is_financial_responsible,
    is_legal_guardian = excluded.is_legal_guardian,
    updated_at = now();
end $$;

commit;
