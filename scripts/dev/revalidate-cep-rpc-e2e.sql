-- ============================================================================
-- REVALIDAÇÃO PÓS-CORREÇÃO — CEP VIA RPCs (Supabase DEV epjshcgsjvrydwuyqixi)
-- ============================================================================
-- Executada após a migration corretiva 20260913100000. Objetivo: provar que o
-- fluxo completo LEAD -> VENDA -> CONTRATO -> ALUNO funciona SEM nenhum
-- UPDATE direto em public.people, incluindo CEP com zero à esquerda.
--
--   A) create_person com p_postal_code '01001-000' -> people.postal_code
--      '01001000' (contratante Renata).
--   B) update_student com p_postal_code '01001-000' -> people.postal_code do
--      aluno '01001000' (via RPC, não via UPDATE direto).
--   C) create_contract_from_sale reflete o CEP do contratante em
--      contracts.contractor_address_snapshot->>'postal_code' (01001000).
--
-- TUDO roda em UMA transação com ROLLBACK final: nenhum dado residual no DEV,
-- script reexecutável. Guard clause exige marcador próprio ausente.
-- ============================================================================

select set_config(
  'request.jwt.claims',
  '{"iss":"supabase","role":"authenticated","sub":"b21f151c-ffee-4860-8874-3f79ec26b9e4"}',
  false
);

-- Guard: reexecução segura (nada persiste; mas evita colisão de marcador)
do $$
begin
  if exists (select 1 from public.crm_leads where commercial_notes like '%E2E QA REVAL CEP 2026%')
     or exists (select 1 from public.people where email like 'qa+revalcep%') then
    raise exception 'Revalidação CEP já aplicada/em curso — aborte e rode reset-e2e-data.sql se necessário.';
  end if;
end $$;

create temp table e2e_checks (sessao text, chave text, detalhe text);

do $$
declare
  v_marker text := 'E2E QA REVAL CEP 2026';
  v_course uuid := '7620f127-7dc5-4efd-90a5-b57c3a64c624'::uuid; -- PROF-0001
  v_lead uuid;
  v_person uuid;
  v_student uuid;
  v_sale_id uuid;
  v_venda json;
  v_renata_res json;
  v_renata uuid;
  v_contract_res json;
  v_contract_id uuid;
  v_postal_aluno text;
  v_postal_renata text;
  v_snapshot_postal text;
  v_lead_code text;
  v_sale_code text;
  v_student_code text;
  v_contract_code text;
  v_resolucao text;
begin
  -- 1) LEAD novo (cliente-fantasma) — People criada via RPC, sem endereço
  v_lead := public.create_crm_lead(
    p_full_name => 'Lucas Prado Monteiro',
    p_phone => '11963335555', p_whatsapp => '11963335555',
    p_email => 'qa+revalcep@profissionaliza.test', p_cpf => '53795241820',
    p_source_code => 'SITE', p_course_interest_id => v_course,
    p_temperature => 'HOT', p_commercial_notes => v_marker, p_force_create => false
  );
  select person_id into v_person from public.crm_leads where id = v_lead;
  select lead_code into v_lead_code from public.crm_leads where id = v_lead;
  select al.metadata->>'identity_resolution' into v_resolucao
    from public.audit_logs al
   where al.action = 'crm.lead_created' and al.entity_type = 'crm_lead' and al.entity_id = v_lead::text;

  -- 2) Pipeline: CONTACT_STARTED -> QUALIFIED -> PROPOSAL_SENT -> NEGOTIATION
  perform public.move_crm_lead_stage(v_lead, '37ffa2c8-5d9e-4056-a706-38c735eed978'::uuid, 'Contato E2E CEP');
  perform public.move_crm_lead_stage(v_lead, '13dd8725-a87c-43dd-97df-08e9caacb760'::uuid, 'Qualificação E2E CEP');
  perform public.move_crm_lead_stage(v_lead, '9a3e286f-26d3-4ceb-9d28-221a3ee45f43'::uuid, 'Proposta E2E CEP');
  perform public.move_crm_lead_stage(v_lead, '88071e38-3ac6-4a39-9b14-bffce9b2ed9d'::uuid, 'Negociação E2E CEP');

  -- 3) Venda CONFIRMED + aluno
  v_venda := public.create_sale_from_lead(
    p_lead_id => v_lead, p_course_id => v_course,
    p_gross_value => 1390.00, p_payment_method => 'PIX',
    p_discount_value => 0, p_installments => 1, p_commercial_notes => v_marker
  );
  v_sale_id := (v_venda->>'sale_id')::uuid;
  select sale_code into v_sale_code from public.sales where id = v_sale_id;
  select student_id into v_student from public.sales where id = v_sale_id;
  select student_code into v_student_code from public.students where id = v_student;

  -- 4) Aluno ATIVO
  perform public.change_student_status(p_student_id => v_student, p_new_status => 'ATIVO', p_reason => 'Matrícula revalidação CEP');

  -- 5) ENDEREÇO DO ALUNO via RPC update_student (SEM update direto em people)
  perform public.update_student(
    p_student_id => v_student, p_full_name => 'Lucas Prado Monteiro',
    p_postal_code => '01001-000', p_street => 'Praça da Sé', p_number => '250',
    p_district => 'Sé', p_city => 'São Paulo', p_state => 'SP',
    p_notes => v_marker
  );
  select postal_code into v_postal_aluno from public.people where id = v_person;

  -- 6) CONTRATANTE via create_person COM CEP iniciado por zero
  v_renata_res := public.create_person(
    p_full_name => 'Renata Prado Monteiro', p_cpf => '68410255900',
    p_birth_date => '1993-03-08', p_email => 'qa+revalcep-c@profissionaliza.test',
    p_phone => '11963336666', p_whatsapp => '11963336666',
    p_postal_code => '01001-000', p_street => 'Praça da Sé', p_number => '250',
    p_district => 'Sé', p_city => 'São Paulo', p_state => 'SP',
    p_notes => v_marker
  );
  v_renata := (v_renata_res->>'person_id')::uuid;
  select postal_code into v_postal_renata from public.people where id = v_renata;

  -- 7) Contrato: DRAFT -> issue -> SIGNED
  v_contract_res := public.create_contract_from_sale(
    p_sale_id => v_sale_id, p_contractor_person_id => v_renata, p_contract_notes => v_marker
  );
  v_contract_id := (v_contract_res->>'contract_id')::uuid;
  select contract_code into v_contract_code from public.contracts where id = v_contract_id;
  perform public.issue_contract(v_contract_id);
  perform public.mark_contract_signed(v_contract_id);

  select c.contractor_address_snapshot->>'postal_code' into v_snapshot_postal
    from public.contracts c where c.id = v_contract_id;

  -- ================= CHECKS =================
  insert into e2e_checks values
    ('FLUXO','lead', 'Lead ' || v_lead_code || ' (resolução ' || v_resolucao || ')'),
    ('FLUXO','pipeline', case when (select count(*) from public.crm_lead_stage_history where lead_id = v_lead) = 5
        then 'PASS: 1 criação + 4 movimentações' else 'FALHOU: history<>5' end),
    ('VENDA','status', (select 'PASS: ' || status from public.sales where id = v_sale_id)),
    ('ALUNO','status', (select 'PASS: ' || status from public.students where id = v_student)),
    ('CONTRATO','status', (select 'PASS: ' || status from public.contracts where id = v_contract_id)),
    ('CEP','aluno', case when v_postal_aluno = '01001000' and char_length(coalesce(v_postal_aluno,'')) = 8
        then 'PASS: update_student -> people.postal_code 01001000' else 'FAIL: ' || coalesce(v_postal_aluno,'<null>') end),
    ('CEP','contratante', case when v_postal_renata = '01001000' and char_length(coalesce(v_postal_renata,'')) = 8
        then 'PASS: create_person -> people.postal_code 01001000' else 'FAIL: ' || coalesce(v_postal_renata,'<null>') end),
    ('CEP','snapshot', case when v_snapshot_postal = '01001000'
        then 'PASS: contractor_address_snapshot->>postal_code 01001000' else 'FAIL: ' || coalesce(v_snapshot_postal,'<null>') end),
    ('FLUXO','codes', 'Lead ' || v_lead_code || ' | Sale ' || v_sale_code || ' | Contract ' || v_contract_code || ' | Student ' || v_student_code);

  exception when others then
    raise exception 'REVAL CEP FALHOU: % (%)', sqlerrm, sqlstate::text using errcode = 'P0001';
end $$;

-- Resultado final (último result set exibido pelo CLI antes do ROLLBACK)
select 'CHK-' || sessao || '-' || chave as checagem, detalhe from e2e_checks order by sessao, chave;

rollback;