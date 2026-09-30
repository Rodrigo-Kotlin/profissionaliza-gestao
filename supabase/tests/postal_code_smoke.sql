-- ---------------------------------------------------------------------------
-- Smoke test — CEP (zeros à esquerda)  —  CORREÇÃO FINAL PR #14
--
-- Estratégia: TUDO dentro de UMA transação (BEGIN ... ROLLBACK). Nenhum dado
-- permanece. Cada cenário é uma função temporária que RETORNA 'OK ...' ou
-- 'FAIL ...' e é exibida pelo CLI como linha de tabela.
--
-- Regra de CEP validada (todas as portas de entrada):
--   '01001-000' -> '01001000'   (nunca '1001000' — bug do ltrim)
--   '01310-100' -> '01310100'
--   '68000-000' -> '68000000'
--   ''  ou NULL -> NULL         (sem CEP)
--   '12345'     -> erro 22023 'Postal code must have 8 digits'
--
-- RPCs cobertas: create_person (A–E), update_person (F), create_student (G),
-- update_student (H). Results são retornados de uma única SELECT final.
-- ---------------------------------------------------------------------------

begin;

create or replace function public._cep_smoke_claim() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"sub":"b21f151c-ffee-4860-8874-3f79ec26b9e4"}', true);
end $$;

-- ---------------------------------------------------------------------------
-- A: create_person '01001-000' -> '01001000' (8 dígitos, zero inicial vivo)
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_a() returns text language plpgsql as $$
declare
  v_res json;
  v_pid uuid;
  v_postal text;
begin
  perform public._cep_smoke_claim();
  v_res := public.create_person(
    p_full_name => 'Cep Teste A',
    p_cpf => '11122233344',
    p_phone => '11970000001',
    p_postal_code => '01001-000');
  v_pid := (v_res->>'person_id')::uuid;
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '01001000' or char_length(coalesce(v_postal, '')) <> 8 then
    return 'FAIL A: esperava 01001000, veio ' || coalesce(v_postal, '<null>');
  end if;
  return 'OK A: 01001-000 -> 01001000 (zero à esquerda preservado)';
exception when others then
  return 'FAIL A: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- B: create_person '01310-100' -> '01310100'
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_b() returns text language plpgsql as $$
declare
  v_res json;
  v_pid uuid;
  v_postal text;
begin
  perform public._cep_smoke_claim();
  v_res := public.create_person(
    p_full_name => 'Cep Teste B',
    p_cpf => '22233344455',
    p_phone => '11970000002',
    p_postal_code => '01310-100');
  v_pid := (v_res->>'person_id')::uuid;
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '01310100' then
    return 'FAIL B: esperava 01310100, veio ' || coalesce(v_postal, '<null>');
  end if;
  return 'OK B: 01310-100 -> 01310100';
exception when others then
  return 'FAIL B: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- C: create_person '68000-000' -> '68000000'
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_c() returns text language plpgsql as $$
declare
  v_res json;
  v_pid uuid;
  v_postal text;
begin
  perform public._cep_smoke_claim();
  v_res := public.create_person(
    p_full_name => 'Cep Teste C',
    p_cpf => '33344455566',
    p_phone => '11970000003',
    p_postal_code => '68000-000');
  v_pid := (v_res->>'person_id')::uuid;
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '68000000' then
    return 'FAIL C: esperava 68000000, veio ' || coalesce(v_postal, '<null>');
  end if;
  return 'OK C: 68000-000 -> 68000000';
exception when others then
  return 'FAIL C: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- D: create_person '' e NULL -> postal NULL (sem CEP, sem erro)
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_d() returns text language plpgsql as $$
declare
  v_res json;
  v_pid uuid;
  v_postal text;
  v_res2 json;
  v_pid2 uuid;
  v_postal2 text;
begin
  perform public._cep_smoke_claim();
  v_res := public.create_person(
    p_full_name => 'Cep Teste D1',
    p_cpf => '44455566677',
    p_phone => '11970000004',
    p_postal_code => '');
  v_pid := (v_res->>'person_id')::uuid;
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is not null then
    return 'FAIL D: vazio deveria gravar NULL, veio ' || v_postal;
  end if;
  v_res2 := public.create_person(
    p_full_name => 'Cep Teste D2',
    p_cpf => '55566677788',
    p_phone => '11970000005');
  v_pid2 := (v_res2->>'person_id')::uuid;
  select postal_code into v_postal2 from public.people where id = v_pid2;
  if v_postal2 is not null then
    return 'FAIL D: NULL deveria gravar NULL, veio ' || v_postal2;
  end if;
  return 'OK D: "" e NULL -> postal NULL (sem alteração de comportamento)';
exception when others then
  return 'FAIL D: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- E: create_person '12345' -> erro 22023 e NENHUMA pessoa criada
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_e() returns text language plpgsql as $$
declare
  v_state text;
  v_fields text;
  v_hit int := 0;
  v_cnt int;
begin
  perform public._cep_smoke_claim();
  begin
    perform public.create_person(
      p_full_name => 'Cep Teste E',
      p_cpf => '66677788899',
      p_phone => '11970000006',
      p_postal_code => '12345');
    return 'FAIL E: esperava erro 22023, criou pessoa';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_fields = message_text;
    if v_state = '22023' then
      v_hit := 1;
    end if;
  end;
  if v_hit <> 1 then
    return 'FAIL E: 22023 nao veio (state=' || coalesce(v_state, '<null>') || ', msg=' || coalesce(v_fields, '<null>') || ')';
  end if;
  select count(*) into v_cnt from public.people where cpf = '66677788899';
  if v_cnt <> 0 then
    return 'FAIL E: pessoa criada indevidamente (count=' || v_cnt || ')';
  end if;
  return 'OK E: CEP inválido -> 22023, nada persistido';
exception when others then
  return 'FAIL E: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- F: update_person — '01001-000' -> '01001000'; inválido -> 22023 mantendo valor;
--    '' -> limpa (NULL)
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_f() returns text language plpgsql as $$
declare
  v_res json;
  v_pid uuid;
  v_postal text;
  v_state text;
  v_fields text;
  v_hit int := 0;
begin
  perform public._cep_smoke_claim();
  v_res := public.create_person(
    p_full_name => 'Cep Teste F',
    p_cpf => '77788899900',
    p_phone => '11970000007');
  v_pid := (v_res->>'person_id')::uuid;

  perform public.update_person(p_person_id => v_pid, p_postal_code => '01001-000');
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '01001000' then
    return 'FAIL F1: update esperava 01001000, veio ' || coalesce(v_postal, '<null>');
  end if;

  begin
    perform public.update_person(p_person_id => v_pid, p_postal_code => '1234');
    return 'FAIL F2: esperava 22023, aceitou CEP inválido';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_fields = message_text;
    if v_state = '22023' then
      v_hit := 1;
    end if;
  end;
  if v_hit <> 1 then
    return 'FAIL F2: 22023 nao veio (state=' || coalesce(v_state, '<null>') || ', msg=' || coalesce(v_fields, '<null>') || ')';
  end if;
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '01001000' then
    return 'FAIL F2: valor anterior foi corrompido (' || coalesce(v_postal, '<null>') || ')';
  end if;

  perform public.update_person(p_person_id => v_pid, p_postal_code => '');
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is not null then
    return 'FAIL F3: "" deveria limpar CEP, veio ' || v_postal;
  end if;
  return 'OK F: update_person 01001-000 -> 01001000, inválido -> 22023 mantendo valor, "" -> NULL';
exception when others then
  return 'FAIL F: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- G: create_student — '01001-000' -> people.postal_code '01001000'
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_g() returns text language plpgsql as $$
declare
  v_sid uuid;
  v_pid uuid;
  v_postal text;
begin
  perform public._cep_smoke_claim();
  v_sid := public.create_student(
    p_full_name => 'Cep Teste G',
    p_cpf => '88899900011',
    p_phone => '11970000008',
    p_postal_code => '01001-000');
  select person_id into v_pid from public.students where id = v_sid;
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '01001000' or char_length(coalesce(v_postal, '')) <> 8 then
    return 'FAIL G: create_student esperava 01001000, veio ' || coalesce(v_postal, '<null>');
  end if;
  return 'OK G: create_student 01001-000 -> people.postal_code 01001000';
exception when others then
  return 'FAIL G: ' || sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- H: update_student — '01310-100' -> people.postal_code '01310100'
-- ---------------------------------------------------------------------------
create or replace function public._cep_smoke_h() returns text language plpgsql as $$
declare
  v_sid uuid;
  v_pid uuid;
  v_postal text;
  v_state text;
  v_fields text;
  v_hit int := 0;
begin
  perform public._cep_smoke_claim();
  v_sid := public.create_student(
    p_full_name => 'Cep Teste H',
    p_cpf => '99900011122',
    p_phone => '11970000009');
  select person_id into v_pid from public.students where id = v_sid;

  perform public.update_student(p_student_id => v_sid, p_full_name => 'Cep Teste H', p_postal_code => '01310-100');
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '01310100' then
    return 'FAIL H1: update_student esperava 01310100, veio ' || coalesce(v_postal, '<null>');
  end if;

  begin
    perform public.update_student(p_student_id => v_sid, p_full_name => 'Cep Teste H', p_postal_code => '1234');
    return 'FAIL H2: esperava 22023, aceitou CEP inválido';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_fields = message_text;
    if v_state = '22023' then
      v_hit := 1;
    end if;
  end;
  if v_hit <> 1 then
    return 'FAIL H2: 22023 nao veio (state=' || coalesce(v_state, '<null>') || ', msg=' || coalesce(v_fields, '<null>') || ')';
  end if;
  select postal_code into v_postal from public.people where id = v_pid;
  if v_postal is distinct from '01310100' then
    return 'FAIL H2: valor anterior foi corrompido (' || coalesce(v_postal, '<null>') || ')';
  end if;
  return 'OK H: update_student 01310-100 -> 01310100, inválido -> 22023 mantendo valor';
exception when others then
  return 'FAIL H: ' || sqlerrm;
end $$;

select
  public._cep_smoke_a() as create_person_cep_a,
  public._cep_smoke_b() as create_person_cep_b,
  public._cep_smoke_c() as create_person_cep_c,
  public._cep_smoke_d() as create_person_cep_d,
  public._cep_smoke_e() as create_person_cep_e,
  public._cep_smoke_f() as update_person_cep_f,
  public._cep_smoke_g() as create_student_cep_g,
  public._cep_smoke_h() as update_student_cep_h;

rollback;