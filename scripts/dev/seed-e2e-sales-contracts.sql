-- ============================================================================
-- SEED E2E — MASSA DE HOMOLOGAÇÃO (Supabase DEV epjshcgsjvrydwuyqixi)
-- ============================================================================
-- Fluxo completo por cliente: LEAD -> VENDA -> CONTRATO -> ALUNO via RPCs REAIS:
--   create_crm_lead -> move_crm_lead_stage x4 -> create_sale_from_lead ->
--   change_student_status -> create_contract_from_sale -> issue_contract ->
--   mark_contract_signed  (+ create_person / link_guardian p/ responsável/terceiro)
--
-- 5 clientes fictícios + 3 cenários de política de identidade (CPF match,
-- name mismatch, contact conflict) + teste CEP 01001-000.
--
-- Identidade: executadas como usuário de reserva (ADMIN, profile único do DEV),
-- via request.jwt.claims — mesmo mecanismo do smoke test da fase 2.4.
--
-- Guard clause: recusa rodar 2x (inicie com reset-e2e-data.sql).
-- Sem migration, sem reset de sequence (numeração continua).
-- ============================================================================

select set_config(
  'request.jwt.claims',
  '{"iss":"supabase","role":"authenticated","sub":"b21f151c-ffee-4860-8874-3f79ec26b9e4"}',
  false
);

-- Guard: seed idempotente (um reset antes de re-seedar)
do $$
begin
  if exists (
    select 1 from public.crm_leads where commercial_notes like '%E2E QA RESET 2026-09%'
  ) or exists (
    select 1 from public.people where email like 'qa+cliente%@profissionaliza.test'
  ) then
    raise exception 'Seed já aplicado — rode scripts/dev/reset-e2e-data.sql antes de re-seedar.';
  end if;
end $$;

create temp table e2e_checks (sessao text, chave text, detalhe text);

-- ===========================================================================
-- CLIENTE 01 — Ana Beatriz Souza (adulta; contratante = ela mesma; PIX à vista)
-- CEP 01001-000 (teste zero à esquerda -> deve gravar 01001000)
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_lead uuid; v_person uuid; v_student uuid; v_sale_id uuid;
  v_course uuid := '7620f127-7dc5-4efd-90a5-b57c3a64c624'::uuid;
  v_sale json; v_contract json; v_contract_id uuid;
begin
  v_lead := public.create_crm_lead(
    p_full_name => 'Ana Beatriz Souza',
    p_phone => '11950001234', p_whatsapp => '11950001234',
    p_email => 'qa+cliente1@profissionaliza.test', p_cpf => '14367890104',
    p_source_code => 'INSTAGRAM', p_course_interest_id => v_course,
    p_temperature => 'HOT', p_commercial_notes => v_marker, p_force_create => false
  );
  select person_id into v_person from public.crm_leads where id = v_lead;

  update public.people
     set birth_date = '1995-04-12',
         postal_code = '01001000', street = 'Praça da Sé', number = '100',
         district = 'Sé', city = 'São Paulo', state = 'SP', notes = v_marker
   where id = v_person;

  perform public.move_crm_lead_stage(v_lead, '37ffa2c8-5d9e-4056-a706-38c735eed978'::uuid, 'Contato inicial E2E');
  perform public.move_crm_lead_stage(v_lead, '13dd8725-a87c-43dd-97df-08e9caacb760'::uuid, 'Qualificação E2E');
  perform public.move_crm_lead_stage(v_lead, '9a3e286f-26d3-4ceb-9d28-221a3ee45f43'::uuid, 'Proposta enviada E2E');
  perform public.move_crm_lead_stage(v_lead, '88071e38-3ac6-4a39-9b14-bffce9b2ed9d'::uuid, 'Negociação E2E');

  v_sale := public.create_sale_from_lead(
    p_lead_id => v_lead, p_course_id => v_course,
    p_gross_value => 1390.00, p_payment_method => 'PIX',
    p_discount_value => 0, p_installments => 1, p_commercial_notes => v_marker
  );
  v_sale_id := (v_sale->>'sale_id')::uuid;
  select student_id into v_student from public.sales where id = v_sale_id;

  perform public.change_student_status(p_student_id => v_student, p_new_status => 'ATIVO', p_reason => 'Matrícula homologada E2E');

  v_contract := public.create_contract_from_sale(
    p_sale_id => v_sale_id, p_contractor_person_id => v_person, p_contract_notes => v_marker
  );
  v_contract_id := (v_contract->>'contract_id')::uuid;
  perform public.issue_contract(v_contract_id);
  perform public.mark_contract_signed(v_contract_id);

  insert into e2e_checks values ('CLIENTE01','fluxo','OK Ana: lead='||v_lead::text||' sale='||v_sale_id::text||' contract='||v_contract_id::text);
end $$;

-- ===========================================================================
-- CLIENTE 02 — Bruno Henrique Lima (adulto; parcelado CC 12x; curso 2)
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_lead uuid; v_person uuid; v_student uuid; v_sale_id uuid;
  v_course uuid := '992e4e1a-3870-46fd-ad05-f11579e5edf0'::uuid;
  v_sale json; v_contract json; v_contract_id uuid;
begin
  v_lead := public.create_crm_lead(
    p_full_name => 'Bruno Henrique Lima',
    p_phone => '11970002345', p_whatsapp => '11970002345',
    p_email => 'qa+cliente2@profissionaliza.test', p_cpf => '28540613905',
    p_source_code => 'SITE', p_course_interest_id => v_course,
    p_temperature => 'WARM', p_commercial_notes => v_marker, p_force_create => false
  );
  select person_id into v_person from public.crm_leads where id = v_lead;
  update public.people set birth_date = '1988-09-23', notes = v_marker where id = v_person;

  perform public.move_crm_lead_stage(v_lead, '37ffa2c8-5d9e-4056-a706-38c735eed978'::uuid, 'Contato inicial E2E');
  perform public.move_crm_lead_stage(v_lead, '13dd8725-a87c-43dd-97df-08e9caacb760'::uuid, 'Qualificação E2E');
  perform public.move_crm_lead_stage(v_lead, '9a3e286f-26d3-4ceb-9d28-221a3ee45f43'::uuid, 'Proposta enviada E2E');
  perform public.move_crm_lead_stage(v_lead, '88071e38-3ac6-4a39-9b14-bffce9b2ed9d'::uuid, 'Negociação E2E');

  v_sale := public.create_sale_from_lead(
    p_lead_id => v_lead, p_course_id => v_course,
    p_gross_value => 7890.00, p_payment_method => 'CARTAO_CREDITO',
    p_discount_value => 0, p_installments => 12, p_commercial_notes => v_marker
  );
  v_sale_id := (v_sale->>'sale_id')::uuid;
  select student_id into v_student from public.sales where id = v_sale_id;

  perform public.change_student_status(p_student_id => v_student, p_new_status => 'ATIVO', p_reason => 'Matrícula homologada E2E');

  v_contract := public.create_contract_from_sale(
    p_sale_id => v_sale_id, p_contractor_person_id => v_person, p_contract_notes => v_marker
  );
  v_contract_id := (v_contract->>'contract_id')::uuid;
  perform public.issue_contract(v_contract_id);
  perform public.mark_contract_signed(v_contract_id);

  insert into e2e_checks values ('CLIENTE02','fluxo','OK Bruno: lead='||v_lead::text||' sale='||v_sale_id::text||' contract='||v_contract_id::text);
end $$;

-- ===========================================================================
-- CLIENTE 03 — Carla Mendes Rocha (MENOR) + Fernanda Mendes Rocha (responsável)
-- Contratante = Fernanda; guardiã RESPONSAVEL_LEGAL / financeira / contato princ.
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_course uuid := '7620f127-7dc5-4efd-90a5-b57c3a64c624'::uuid;
  v_fernanda uuid;
  v_lead uuid; v_person uuid; v_student uuid; v_sale_id uuid;
  v_sale json; v_contract json; v_contract_id uuid;
  v_general json;
begin
  v_general := public.create_person(
    p_full_name => 'Fernanda Mendes Rocha', p_cpf => '71294305670',
    p_birth_date => '1980-02-15', p_email => 'qa+responsavel3@profissionaliza.test',
    p_phone => '11989991111', p_whatsapp => '11989991111',
    p_street => 'Av. Paulista', p_number => '900', p_district => 'Bela Vista',
    p_city => 'São Paulo', p_state => 'SP', p_notes => v_marker
  );
  v_fernanda := (v_general->>'person_id')::uuid;

  v_lead := public.create_crm_lead(
    p_full_name => 'Carla Mendes Rocha',
    p_phone => '11980003456',
    p_email => 'qa+cliente3@profissionaliza.test', p_cpf => '40286157470',
    p_source_code => 'PRESENCIAL', p_course_interest_id => v_course,
    p_temperature => 'WARM', p_commercial_notes => v_marker, p_force_create => false
  );
  select person_id into v_person from public.crm_leads where id = v_lead;
  update public.people set birth_date = '2014-06-30', notes = v_marker where id = v_person;

  perform public.move_crm_lead_stage(v_lead, '37ffa2c8-5d9e-4056-a706-38c735eed978'::uuid, 'Contato inicial E2E');
  perform public.move_crm_lead_stage(v_lead, '13dd8725-a87c-43dd-97df-08e9caacb760'::uuid, 'Qualificação E2E');
  perform public.move_crm_lead_stage(v_lead, '9a3e286f-26d3-4ceb-9d28-221a3ee45f43'::uuid, 'Proposta enviada E2E');
  perform public.move_crm_lead_stage(v_lead, '88071e38-3ac6-4a39-9b14-bffce9b2ed9d'::uuid, 'Negociação E2E');

  v_sale := public.create_sale_from_lead(
    p_lead_id => v_lead, p_course_id => v_course,
    p_gross_value => 1390.00, p_payment_method => 'DINHEIRO',
    p_discount_value => 0, p_installments => 1, p_commercial_notes => v_marker
  );
  v_sale_id := (v_sale->>'sale_id')::uuid;
  select student_id into v_student from public.sales where id = v_sale_id;

  perform public.change_student_status(p_student_id => v_student, p_new_status => 'ATIVO', p_reason => 'Matrícula homologada E2E');

  -- Guardiã = Fernanda (reutiliza people por CPF)
  perform public.link_guardian(
    p_student_id => v_student, p_full_name => 'Fernanda Mendes Rocha',
    p_cpf => '71294305670', p_relationship => 'RESPONSAVEL_LEGAL',
    p_phone => '11989991111', p_email => 'qa+responsavel3@profissionaliza.test',
    p_is_primary_contact => true, p_is_financial_responsible => true,
    p_is_legal_guardian => true, p_notes => v_marker
  );

  -- Contratante = Fernanda
  v_contract := public.create_contract_from_sale(
    p_sale_id => v_sale_id, p_contractor_person_id => v_fernanda, p_contract_notes => v_marker
  );
  v_contract_id := (v_contract->>'contract_id')::uuid;
  perform public.issue_contract(v_contract_id);
  perform public.mark_contract_signed(v_contract_id);

  insert into e2e_checks values ('CLIENTE03','fluxo','OK Carla (menor): lead='||v_lead::text||' sale='||v_sale_id::text||' contract='||v_contract_id::text||' responsavel='||v_fernanda::text);
end $$;

-- ===========================================================================
-- CLIENTE 04 — Diego Alves Martins + Juliana Alves Martins (terceiro contratante)
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_course uuid := '992e4e1a-3870-46fd-ad05-f11579e5edf0'::uuid;
  v_juliana uuid;
  v_lead uuid; v_person uuid; v_student uuid; v_sale_id uuid;
  v_sale json; v_contract json; v_contract_id uuid;
  v_general json;
begin
  v_general := public.create_person(
    p_full_name => 'Juliana Alves Martins', p_cpf => '59026138768',
    p_birth_date => '1994-07-19', p_email => 'qa+contratante4@profissionaliza.test',
    p_phone => '11991112222', p_whatsapp => '11991112222',
    p_city => 'Campinas', p_state => 'SP', p_notes => v_marker
  );
  v_juliana := (v_general->>'person_id')::uuid;

  v_lead := public.create_crm_lead(
    p_full_name => 'Diego Alves Martins',
    p_phone => '11990004567',
    p_email => 'qa+cliente4@profissionaliza.test', p_cpf => '66930217867',
    p_source_code => 'WHATSAPP', p_course_interest_id => v_course,
    p_temperature => 'HOT', p_commercial_notes => v_marker, p_force_create => false
  );
  select person_id into v_person from public.crm_leads where id = v_lead;
  update public.people set birth_date = '1992-01-11', notes = v_marker where id = v_person;

  perform public.move_crm_lead_stage(v_lead, '37ffa2c8-5d9e-4056-a706-38c735eed978'::uuid, 'Contato inicial E2E');
  perform public.move_crm_lead_stage(v_lead, '13dd8725-a87c-43dd-97df-08e9caacb760'::uuid, 'Qualificação E2E');
  perform public.move_crm_lead_stage(v_lead, '9a3e286f-26d3-4ceb-9d28-221a3ee45f43'::uuid, 'Proposta enviada E2E');
  perform public.move_crm_lead_stage(v_lead, '88071e38-3ac6-4a39-9b14-bffce9b2ed9d'::uuid, 'Negociação E2E');

  v_sale := public.create_sale_from_lead(
    p_lead_id => v_lead, p_course_id => v_course,
    p_gross_value => 7890.00, p_payment_method => 'BOLETO',
    p_discount_value => 300.00, p_installments => 6, p_commercial_notes => v_marker
  );
  v_sale_id := (v_sale->>'sale_id')::uuid;
  select student_id into v_student from public.sales where id = v_sale_id;

  perform public.change_student_status(p_student_id => v_student, p_new_status => 'ATIVO', p_reason => 'Matrícula homologada E2E');

  -- Cônjuge contratante como guardiã? Contrato é de Juliana (terceiro contratante).
  perform public.link_guardian(
    p_student_id => v_student, p_full_name => 'Juliana Alves Martins',
    p_cpf => '59026138768', p_relationship => 'CONJUGE',
    p_phone => '11991112222', p_email => 'qa+contratante4@profissionaliza.test',
    p_is_primary_contact => false, p_is_financial_responsible => true,
    p_is_legal_guardian => false, p_notes => v_marker
  );

  v_contract := public.create_contract_from_sale(
    p_sale_id => v_sale_id, p_contractor_person_id => v_juliana, p_contract_notes => v_marker
  );
  v_contract_id := (v_contract->>'contract_id')::uuid;
  perform public.issue_contract(v_contract_id);
  perform public.mark_contract_signed(v_contract_id);

  insert into e2e_checks values ('CLIENTE04','fluxo','OK Diego: lead='||v_lead::text||' sale='||v_sale_id::text||' contract='||v_contract_id::text||' contratante='||v_juliana::text);
end $$;

-- ===========================================================================
-- CLIENTE 05 — Elisa Ramos Costa (CPF/telefone/email únicos; sem conflitos)
-- CEP 01001-000 (segundo teste zero à esquerda)
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_lead uuid; v_person uuid; v_student uuid; v_sale_id uuid;
  v_course uuid := '7620f127-7dc5-4efd-90a5-b57c3a64c624'::uuid;
  v_sale json; v_contract json; v_contract_id uuid;
begin
  v_lead := public.create_crm_lead(
    p_full_name => 'Elisa Ramos Costa',
    p_phone => '11992223333', p_whatsapp => '11994445555',
    p_email => 'qa+cliente5@profissionaliza.test', p_cpf => '83102749550',
    p_source_code => 'CAMPANHA', p_course_interest_id => v_course,
    p_temperature => 'COLD', p_commercial_notes => v_marker, p_force_create => false
  );
  select person_id into v_person from public.crm_leads where id = v_lead;

  update public.people
     set birth_date = '1997-05-05',
         postal_code = '01001000', street = 'Praça da Sé', number = '120',
         district = 'Sé', city = 'São Paulo', state = 'SP', notes = v_marker
   where id = v_person;

  perform public.move_crm_lead_stage(v_lead, '37ffa2c8-5d9e-4056-a706-38c735eed978'::uuid, 'Contato inicial E2E');
  perform public.move_crm_lead_stage(v_lead, '13dd8725-a87c-43dd-97df-08e9caacb760'::uuid, 'Qualificação E2E');
  perform public.move_crm_lead_stage(v_lead, '9a3e286f-26d3-4ceb-9d28-221a3ee45f43'::uuid, 'Proposta enviada E2E');
  perform public.move_crm_lead_stage(v_lead, '88071e38-3ac6-4a39-9b14-bffce9b2ed9d'::uuid, 'Negociação E2E');

  v_sale := public.create_sale_from_lead(
    p_lead_id => v_lead, p_course_id => v_course,
    p_gross_value => 1390.00, p_payment_method => 'TRANSFERENCIA',
    p_discount_value => 0, p_installments => 1, p_commercial_notes => v_marker
  );
  v_sale_id := (v_sale->>'sale_id')::uuid;
  select student_id into v_student from public.sales where id = v_sale_id;

  perform public.change_student_status(p_student_id => v_student, p_new_status => 'ATIVO', p_reason => 'Matrícula homologada E2E');

  v_contract := public.create_contract_from_sale(
    p_sale_id => v_sale_id, p_contractor_person_id => v_person, p_contract_notes => v_marker
  );
  v_contract_id := (v_contract->>'contract_id')::uuid;
  perform public.issue_contract(v_contract_id);
  perform public.mark_contract_signed(v_contract_id);

  insert into e2e_checks values ('CLIENTE05','fluxo','OK Elisa: lead='||v_lead::text||' sale='||v_sale_id::text||' contract='||v_contract_id::text);
end $$;

-- ===========================================================================
-- CENÁRIO A — CPF já existente + nome compatível => reuso (cpf_exact)
-- Referência: CPF 14367890104 (Ana). Nome idêntico.
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_lead uuid; v_person uuid; v_ana uuid;
  v_course uuid := '7620f127-7dc5-4efd-90a5-b57c3a64c624'::uuid;
begin
  select id into v_ana from public.people where cpf = '14367890104';

  v_lead := public.create_crm_lead(
    p_full_name => 'Ana Beatriz Souza',
    p_phone => '11990001001',
    p_email => 'qa+dupexat@profissionaliza.test', p_cpf => '14367890104',
    p_source_code => 'LIGACAO', p_course_interest_id => v_course,
    p_temperature => 'COLD', p_commercial_notes => v_marker, p_force_create => false
  );
  select person_id into v_person from public.crm_leads where id = v_lead;

  if v_person = v_ana then
    insert into e2e_checks values ('CPF_EXACT','reuso','PASS: lead '||(select lead_code from public.crm_leads where id = v_lead)||' reutilizou person='||v_person::text);
  else
    insert into e2e_checks values ('CPF_EXACT','reuso','FALHOU: person='||v_person::text||' esperado '||v_ana::text);
  end if;
end $$;

-- ===========================================================================
-- CENÁRIO B — CPF existente + nome DIVERGENTE => LEAD_NAME_MISMATCH (sem auto-associação)
-- Depois p_force_create=true => cpf_exact_forced (reuso confirmado)
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_lead uuid; v_person uuid; v_ana uuid;
  v_course uuid := '7620f127-7dc5-4efd-90a5-b57c3a64c624'::uuid;
begin
  select id into v_ana from public.people where cpf = '14367890104';

  begin
    v_lead := public.create_crm_lead(
      p_full_name => 'Maria Souza das Rosas',
      p_phone => '11990002002',
      p_email => 'qa+dupmismatch@profissionaliza.test', p_cpf => '14367890104',
      p_source_code => 'LIGACAO', p_course_interest_id => v_course,
      p_temperature => 'COLD', p_commercial_notes => v_marker, p_force_create => false
    );
    insert into e2e_checks values ('NAME_MISMATCH','erro','FALHOU: lead criado sem erro ('||v_lead||')');
  exception when raise_exception then
    if sqlerrm like '%LEAD_NAME_MISMATCH%' then
      insert into e2e_checks values ('NAME_MISMATCH','erro','PASS: LEAD_NAME_MISMATCH sem auto-associação');
    else
      insert into e2e_checks values ('NAME_MISMATCH','erro','FALHOU: erro inesperado: '||sqlerrm);
    end if;
  end;

  -- Força e valida reuso por CPF
  v_lead := public.create_crm_lead(
    p_full_name => 'Maria Souza das Rosas',
    p_phone => '11990002002',
    p_email => 'qa+dupmismatch@profissionaliza.test', p_cpf => '14367890104',
    p_source_code => 'LIGACAO', p_course_interest_id => v_course,
    p_temperature => 'COLD', p_commercial_notes => v_marker, p_force_create => true
  );
  select person_id into v_person from public.crm_leads where id = v_lead;
  if v_person = v_ana then
    insert into e2e_checks values ('NAME_MISMATCH','forcado','PASS: cpf_exact_forced reutilizou person='||v_person::text||' lead='||(select lead_code from public.crm_leads where id = v_lead));
  else
    insert into e2e_checks values ('NAME_MISMATCH','forcado','FALHOU: person='||v_person::text||' esperado '||v_ana::text);
  end if;
end $$;

-- ===========================================================================
-- CENÁRIO C — SEM CPF + telefone já existente => POSSIBLE_DUPLICATE:phone
-- Depois p_force_create=true => contact_conflict_forced (nova People)
-- ===========================================================================
do $$
declare
  v_marker text := 'E2E QA RESET 2026-09';
  v_lead uuid; v_person uuid; v_ana uuid;
  v_course uuid := '7620f127-7dc5-4efd-90a5-b57c3a64c624'::uuid;
begin
  select id into v_ana from public.people where cpf = '14367890104';
  -- Sem CPF; telefone = telefone da Ana -> conflito
  begin
    v_lead := public.create_crm_lead(
      p_full_name => 'Pedro Conflito Dias',
      p_phone => '11950001234',
      p_email => 'qa+dupconfone@profissionaliza.test',
      p_source_code => 'LIGACAO', p_course_interest_id => v_course,
      p_temperature => 'COLD', p_commercial_notes => v_marker, p_force_create => false
    );
    insert into e2e_checks values ('CONTACT_CONFLICT','erro','FALHOU: lead criado sem erro ('||v_lead||')');
  exception when raise_exception then
    if sqlerrm like '%POSSIBLE_DUPLICATE:phone%' then
      insert into e2e_checks values ('CONTACT_CONFLICT','erro','PASS: POSSIBLE_DUPLICATE:phone sem nova pessoa');
    else
      insert into e2e_checks values ('CONTACT_CONFLICT','erro','FALHOU: erro inesperado: '||sqlerrm);
    end if;
  end;

  -- Força criação => nova People (id != Ana)
  v_lead := public.create_crm_lead(
    p_full_name => 'Pedro Conflito Dias',
    p_phone => '11950001234',
    p_email => 'qa+dupconfone@profissionaliza.test',
    p_source_code => 'LIGACAO', p_course_interest_id => v_course,
    p_temperature => 'COLD', p_commercial_notes => v_marker, p_force_create => true
  );
  select person_id into v_person from public.crm_leads where id = v_lead;
  if v_person is distinct from v_ana and v_person is not null then
    insert into e2e_checks values ('CONTACT_CONFLICT','forcado','PASS: contact_conflict_forced criou nova person='||v_person::text||' lead='||(select lead_code from public.crm_leads where id = v_lead));
  else
    insert into e2e_checks values ('CONTACT_CONFLICT','forcado','FALHOU: person='||coalesce(v_person::text,'null')||' esperado diferente de '||v_ana::text);
  end if;
end $$;

-- ===========================================================================
-- RESULTADO FINAL (último result set): lineage dos 5 clientes + cenários
-- ===========================================================================
with base as (
  select
    case p.email
      when 'qa+cliente1@profissionaliza.test' then '01'
      when 'qa+cliente2@profissionaliza.test' then '02'
      when 'qa+cliente3@profissionaliza.test' then '03'
      when 'qa+cliente4@profissionaliza.test' then '04'
      when 'qa+cliente5@profissionaliza.test' then '05'
    end as cliente,
    p.id as person_id, p.full_name as persona,
    l.lead_code, l.id as lead_id,
    s.sale_code, s.status as sale_status,
    ct.contract_code, ct.status as contract_status,
    cp.full_name as contratante,
    st.student_code, st.status as student_status,
    al.metadata->>'identity_resolution' as resolucao
  from public.people p
  join public.crm_leads l on l.person_id = p.id
  join public.sales s on s.lead_id = l.id
  join public.contracts ct on ct.sale_id = s.id
  join public.people cp on cp.id = ct.contractor_person_id
  join public.students st on st.person_id = p.id
  left join public.audit_logs al
         on al.action = 'crm.lead_created' and al.entity_type = 'crm_lead' and al.entity_id = l.id::text
  where p.email in (
    'qa+cliente1@profissionaliza.test','qa+cliente2@profissionaliza.test',
    'qa+cliente3@profissionaliza.test','qa+cliente4@profissionaliza.test',
    'qa+cliente5@profissionaliza.test'
  )
)
select
  cliente as "Cliente",
  lead_code as "Lead",
  persona as "Person",
  student_code || ' (' || student_status || ')' as "Student",
  sale_code || ' (' || sale_status || ')' as "Sale",
  contract_code || ' (' || contract_status || ')' as "Contract",
  contratante as "Contractor",
  case when contract_status = 'SIGNED' and sale_status = 'CONFIRMED' and student_status = 'ATIVO'
       then 'OK LEAD→VENDA→CONTRATO→ALUNO' else 'ATENÇÃO' end as "Final",
  resolucao as "Resolução"
from base
order by cliente;

-- Checks dos cenários (mesmo batch; consultas adicionais via db query depois)
select 'CHK-' || sessao || '-' || chave as checagem, detalhe from e2e_checks order by sessao, chave;