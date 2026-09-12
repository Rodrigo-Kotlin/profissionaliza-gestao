-- ---------------------------------------------------------------------------
-- Smoke test — create_crm_lead v2 (identity safety)  —  BLOCKER PR #14
--
-- Estrategia: TUDO dentro de UMA transacao (BEGIN ... ROLLBACK). Nenhum dado
-- permanece. Cada cenario e uma funcao temporaria que RETORNA 'OK ...' ou
-- 'FAIL ...' e e exibida pelo CLI como linha de tabela.
--
-- CPFs validos usados (digitos verificadores corretos):
--   Maria Souza  -> 111.444.777-35
--   Beto         -> 987.654.321-00
--
-- Cenarios:
--   PRE  cria Maria Souza (cpf, tel, whatsapp, email)
--   A    sem CPF, contatos novos           -> new_person
--   B    CPF novo + telefone da Maria      -> CPF prevalece, pessoa nova, SEM conflito
--   C    CPF da Maria + nome Maria         -> reutiliza Maria (cpf_exact)
--   D    CPF da Maria + nome sem overlap   -> POSSIBLE_DUPLICATE:name,cpf (P0001)
--   E    igual a D + force                 -> reutiliza Maria (cpf_exact_forced)
--   F    sem CPF + telefone da Maria       -> POSSIBLE_DUPLICATE:phone (P0001)
--   G    igual a F + force                 -> pessoa nova (contact_conflict_forced)
--   H    sem CPF, contatos novos           -> new_person
--   I    sem CPF + telefone e whatsapp     -> POSSIBLE_DUPLICATE:phone,whatsapp (P0001)
-- ---------------------------------------------------------------------------

begin;

create or replace function public._smoke_claim() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"sub":"b21f151c-ffee-4860-8874-3f79ec26b9e4"}', true);
end $$;

-- ---------------------------------------------------------------------------
-- PRE
-- ---------------------------------------------------------------------------
create or replace function public._smoke_pre() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_person_id uuid;
begin
  perform public._smoke_claim();
  select id into v_person_id from public.people where cpf = '11144477735';
  if v_person_id is not null then
    return 'OK PRE: Maria ja existia';
  end if;
  v_lead_id := public.create_crm_lead(
    p_full_name => 'Maria Souza',
    p_phone => '11912340001',
    p_whatsapp => '11912340002',
    p_email => 'maria.smoke@example.com',
    p_cpf => '111.444.777-35',
    p_source_code => 'OUTRO');
  select id into v_person_id from public.people where cpf = '11144477735';
  if v_person_id is null then
    return 'FAIL PRE: Maria nao criada';
  end if;
  return 'OK PRE: Maria criada (lead ' || v_lead_id || ')';
exception when others then
  return 'FAIL PRE: ' || sqlerrm;
end $$;

create or replace function public._smoke_a() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_person_id uuid;
  v_cpf text;
  v_cnt int;
  v_res text;
begin
  perform public._smoke_claim();
  v_lead_id := public.create_crm_lead(
    p_full_name => 'Ana Novata',
    p_phone => '11990000111',
    p_email => 'ana.smoke@example.com',
    p_source_code => 'OUTRO');
  select p.id, p.cpf into v_person_id, v_cpf
    from public.crm_leads l join public.people p on p.id = l.person_id
   where l.id = v_lead_id;
  if v_cpf is not null then
    return 'FAIL A: pessoa ganhou CPF indevido (' || v_cpf || ')';
  end if;
  select count(*) into v_cnt from public.people
   where phone = '11990000111' and email = 'ana.smoke@example.com' and cpf is null;
  if v_cnt <> 1 then
    return 'FAIL A: pessoa com contatos esperados nao encontrada (count=' || v_cnt || ')';
  end if;
  select m.identity_resolution into v_res
    from public.audit_logs a,
         jsonb_to_record(a.metadata) as m(identity_resolution text)
   where a.entity_id = v_lead_id::text and a.action = 'crm.lead_created';
  if v_res is distinct from 'new_person' then
    return 'FAIL A: resolution=' || coalesce(v_res, '<null>') || ' (esperava new_person)';
  end if;
  return 'OK A: new_person, pessoa limpa (person ' || v_person_id || ')';
exception when others then
  return 'FAIL A: ' || sqlerrm;
end $$;

create or replace function public._smoke_b() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_person_id uuid;
  v_cpf text;
  v_phone text;
  v_res text;
begin
  perform public._smoke_claim();
  v_lead_id := public.create_crm_lead(
    p_full_name => 'Beto Camargo',
    p_phone => '11912340001',
    p_cpf => '987.654.321-00',
    p_source_code => 'OUTRO');
  select p.id, p.cpf into v_person_id, v_cpf
    from public.crm_leads l join public.people p on p.id = l.person_id
   where l.id = v_lead_id;
  if v_cpf <> '98765432100' then
    return 'FAIL B: CPF=' || coalesce(v_cpf, '<null>') || ' (esperava 98765432100)';
  end if;
  select p.phone into v_phone from public.people p where p.id = v_person_id;
  if v_phone <> '11912340001' then
    return 'FAIL B: telefone=' || coalesce(v_phone, '<null>') || ' divergente';
  end if;
  select m.identity_resolution into v_res
    from public.audit_logs a,
         jsonb_to_record(a.metadata) as m(identity_resolution text)
   where a.entity_id = v_lead_id::text and a.action = 'crm.lead_created';
  if v_res is distinct from 'new_person' then
    return 'FAIL B: resolution=' || coalesce(v_res, '<null>') || ' (esperava new_person)';
  end if;
  return 'OK B: CPF prevaleceu, pessoa nova, sem conflito (person ' || v_person_id || ')';
exception when others then
  return 'FAIL B: ' || sqlerrm;
end $$;

create or replace function public._smoke_c() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_person_id uuid;
  v_maria uuid;
begin
  perform public._smoke_claim();
  select id into v_maria from public.people where cpf = '11144477735';
  v_lead_id := public.create_crm_lead(
    p_full_name => 'Maria Souza',
    p_cpf => '111.444.777-35',
    p_source_code => 'OUTRO');
  select person_id into v_person_id from public.crm_leads where id = v_lead_id;
  if v_person_id <> v_maria then
    return 'FAIL C: esperava reuso da Maria (person ' || v_maria || '), veio ' || v_person_id;
  end if;
  return 'OK C: reutilizou Maria por CPF (person ' || v_person_id || ')';
exception when others then
  return 'FAIL C: ' || sqlerrm;
end $$;

create or replace function public._smoke_d() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_state text;
  v_fields text;
  v_hit int := 0;
  v_leads_apos int;
begin
  perform public._smoke_claim();
  select count(*) into v_leads_apos from public.crm_leads;
  begin
    v_lead_id := public.create_crm_lead(
      p_full_name => 'Fulano Beltrano',
      p_cpf => '111.444.777-35',
      p_source_code => 'OUTRO');
    return 'FAIL D: esperava POSSIBLE_DUPLICATE, criou lead ' || v_lead_id;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    v_fields := sqlerrm;
    if v_state = 'P0001' and v_fields = 'POSSIBLE_DUPLICATE:name,cpf' then
      v_hit := 1;
    end if;
  end;
  if v_hit <> 1 then
    return 'FAIL D: P0001 name,cpf nao veio (state=' || coalesce(v_state, '<null>') || ', msg=' || coalesce(v_fields, '<null>') || ')';
  end if;
  if (select count(*) from public.crm_leads) <> v_leads_apos then
    return 'FAIL D: lead foi criado indevidamente';
  end if;
  return 'OK D: bloqueio P0001 name,cpf, nenhum lead criado (auditoria de conflito e transacional e revertida com o raise da chamada)';
exception when others then
  return 'FAIL D: ' || sqlerrm;
end $$;

create or replace function public._smoke_e() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_person_id uuid;
  v_maria uuid;
  v_res text;
begin
  perform public._smoke_claim();
  select id into v_maria from public.people where cpf = '11144477735';
  v_lead_id := public.create_crm_lead(
    p_full_name => 'Fulano Beltrano',
    p_cpf => '111.444.777-35',
    p_source_code => 'OUTRO',
    p_force_create => true);
  select person_id into v_person_id from public.crm_leads where id = v_lead_id;
  if v_person_id <> v_maria then
    return 'FAIL E: force deveria reutilizar Maria (person ' || v_maria || '), veio ' || v_person_id;
  end if;
  select m.identity_resolution into v_res
    from public.audit_logs a,
         jsonb_to_record(a.metadata) as m(identity_resolution text)
   where a.entity_id = v_lead_id::text and a.action = 'crm.lead_created';
  if v_res is distinct from 'cpf_exact_forced' then
    return 'FAIL E: resolution=' || coalesce(v_res, '<null>') || ' (esperava cpf_exact_forced)';
  end if;
  return 'OK E: force reutilizou Maria (person ' || v_person_id || ', ' || v_res || ')';
exception when others then
  return 'FAIL E: ' || sqlerrm;
end $$;

create or replace function public._smoke_f() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_state text;
  v_fields text;
  v_hit int := 0;
  v_leads_apos int;
begin
  perform public._smoke_claim();
  select count(*) into v_leads_apos from public.crm_leads;
  begin
    v_lead_id := public.create_crm_lead(
      p_full_name => 'Curioso Costa',
      p_phone => '11912340001',
      p_source_code => 'OUTRO');
    return 'FAIL F: esperava POSSIBLE_DUPLICATE, criou lead ' || v_lead_id;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    v_fields := sqlerrm;
    if v_state = 'P0001' and v_fields = 'POSSIBLE_DUPLICATE:phone' then
      v_hit := 1;
    end if;
  end;
  if v_hit <> 1 then
    return 'FAIL F: P0001 phone nao veio (state=' || coalesce(v_state, '<null>') || ', msg=' || coalesce(v_fields, '<null>') || ')';
  end if;
  if (select count(*) from public.crm_leads) <> v_leads_apos then
    return 'FAIL F: lead foi criado indevidamente';
  end if;
  return 'OK F: bloqueio P0001 por telefone, nenhum lead criado';
exception when others then
  return 'FAIL F: ' || sqlerrm;
end $$;

create or replace function public._smoke_g() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_person_id uuid;
  v_cnt int;
  v_res text;
begin
  perform public._smoke_claim();
  v_lead_id := public.create_crm_lead(
    p_full_name => 'Curioso Costa',
    p_phone => '11912340001',
    p_source_code => 'OUTRO',
    p_force_create => true);
  select person_id into v_person_id from public.crm_leads where id = v_lead_id;
  select count(*) into v_cnt from public.people where phone = '11912340001';
  if v_cnt < 2 then
    return 'FAIL G: force deveria criar pessoa nova (people com tel=' || v_cnt || ')';
  end if;
  select m.identity_resolution into v_res
    from public.audit_logs a,
         jsonb_to_record(a.metadata) as m(identity_resolution text)
   where a.entity_id = v_lead_id::text and a.action = 'crm.lead_created';
  if v_res is distinct from 'contact_conflict_forced' then
    return 'FAIL G: resolution=' || coalesce(v_res, '<null>') || ' (esperava contact_conflict_forced)';
  end if;
  return 'OK G: force criou pessoa nova (person ' || v_person_id || ', ' || v_res || ')';
exception when others then
  return 'FAIL G: ' || sqlerrm;
end $$;

create or replace function public._smoke_h() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_cpf text;
  v_res text;
begin
  perform public._smoke_claim();
  v_lead_id := public.create_crm_lead(
    p_full_name => 'Helena Freira',
    p_phone => '11880000222',
    p_whatsapp => '11880000223',
    p_email => 'helena.smoke@example.com',
    p_source_code => 'OUTRO');
  select p.cpf into v_cpf
    from public.crm_leads l join public.people p on p.id = l.person_id
   where l.id = v_lead_id;
  if v_cpf is not null then
    return 'FAIL H: CPF indevido na pessoa (' || v_cpf || ')';
  end if;
  select m.identity_resolution into v_res
    from public.audit_logs a,
         jsonb_to_record(a.metadata) as m(identity_resolution text)
   where a.entity_id = v_lead_id::text and a.action = 'crm.lead_created';
  if v_res is distinct from 'new_person' then
    return 'FAIL H: resolution=' || coalesce(v_res, '<null>') || ' (esperava new_person)';
  end if;
  return 'OK H: sem CPF sem conflito -> new_person (lead ' || v_lead_id || ')';
exception when others then
  return 'FAIL H: ' || sqlerrm;
end $$;

create or replace function public._smoke_i() returns text language plpgsql as $$
declare
  v_lead_id uuid;
  v_state text;
  v_fields text;
  v_hit int := 0;
  v_leads_apos int;
begin
  perform public._smoke_claim();
  select count(*) into v_leads_apos from public.crm_leads;
  begin
    v_lead_id := public.create_crm_lead(
      p_full_name => 'Iuri Duplo',
      p_phone => '11912340001',
      p_whatsapp => '11912340002',
      p_source_code => 'OUTRO');
    return 'FAIL I: esperava POSSIBLE_DUPLICATE, criou lead ' || v_lead_id;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    v_fields := sqlerrm;
    if v_state = 'P0001' and v_fields = 'POSSIBLE_DUPLICATE:phone,whatsapp' then
      v_hit := 1;
    end if;
  end;
  if v_hit <> 1 then
    return 'FAIL I: P0001 phone,whatsapp nao veio (state=' || coalesce(v_state, '<null>') || ', msg=' || coalesce(v_fields, '<null>') || ')';
  end if;
  if (select count(*) from public.crm_leads) <> v_leads_apos then
    return 'FAIL I: lead foi criado indevidamente';
  end if;
  return 'OK I: bloqueio multi-contato (phone,whatsapp) P0001, nenhum lead criado';
exception when others then
  return 'FAIL I: ' || sqlerrm;
end $$;

select public._smoke_pre() as cenario_pre;

select
  public._smoke_a() as a,
  public._smoke_b() as b,
  public._smoke_c() as c,
  public._smoke_d() as d,
  public._smoke_e() as e,
  public._smoke_f() as f,
  public._smoke_g() as g,
  public._smoke_h() as h,
  public._smoke_i() as i;

rollback;