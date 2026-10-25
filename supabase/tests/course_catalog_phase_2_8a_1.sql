-- FASE 2.8A.1 — smoke tests da carga oficial.
-- Executar em ambiente de homologação após aplicar a migration; não aplica
-- alterações e não deve ser executado contra produção nesta fase.
do $$
declare
  r record;
  v_course public.courses%rowtype;
  v_online integer;
  v_regular integer;
  v_total integer;
begin
  for r in select * from (values
    ('CUR-00001','Estética e Beleza','PRESENCIAL',null::integer,10,'MONTHS','NONE'),
    ('CUR-00002','Cabeleireiro','PRESENCIAL',null::integer,8,'MONTHS','NONE'),
    ('CUR-00003','Barbeiro','PRESENCIAL',null::integer,7,'MONTHS','NONE'),
    ('CUR-00004','Atendente de Farmácia','PRESENCIAL',null::integer,10,'MONTHS','NONE'),
    ('CUR-00005','Máquinas Pesadas','PRESENCIAL',null::integer,5,'MONTHS','NONE'),
    ('CUR-00006','Auxiliar de Necropsia','PRESENCIAL',null::integer,10,'MONTHS','NONE'),
    ('CUR-00007','Eletricista Predial ou Refrigeração','PRESENCIAL',null::integer,5,'MONTHS','NEEDS_BUSINESS_REVIEW'),
    ('CUR-00008','Massoterapia','PRESENCIAL',null::integer,5,'MONTHS','NONE'),
    ('CUR-00009','Pacote Industrial Eletricista + Refrigeração','PRESENCIAL',null::integer,10,'MONTHS','NEEDS_BUSINESS_REVIEW'),
    ('CUR-00010','Frentista NR-20','PRESENCIAL',null::integer,3,'DAYS','NONE'),
    ('CUR-00011','Recepcionista de Clínicas','PRESENCIAL',null::integer,4,'DAYS','NONE'),
    ('CUR-00012','Auxiliar em Radiologia','ONLINE',40,null::integer,null,'NONE'),
    ('CUR-00013','Auxiliar de Creche','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00014','Auxiliar de Necrópsia','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00015','Auxiliar de Veterinário','ONLINE',80,null::integer,null,'NONE'),
    ('CUR-00016','Auxiliar em Análises Clínicas','ONLINE',60,null::integer,null,'NONE'),
    ('CUR-00017','Barbeiro Profissional','ONLINE',80,null::integer,null,'NONE'),
    ('CUR-00018','Cuidador de Idoso','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00019','Designer de Cílios & Sobrancelha','ONLINE',15,null::integer,null,'NONE'),
    ('CUR-00020','Instalador de Energia Solar','ONLINE',80,null::integer,null,'NONE'),
    ('CUR-00021','Agente Comunitário de Saúde','ONLINE',80,null::integer,null,'NONE'),
    ('CUR-00022','Teologia Histórica','ONLINE',100,null::integer,null,'NONE'),
    ('CUR-00023','Fiscal de Loja','ONLINE',10,null::integer,null,'NONE'),
    ('CUR-00024','Frentista Profissional','ONLINE',40,null::integer,null,'NONE'),
    ('CUR-00025','Manicure e Pedicure','ONLINE',50,null::integer,null,'NONE'),
    ('CUR-00026','Maquiagem','ONLINE',15,null::integer,null,'NONE'),
    ('CUR-00027','Massagem Modeladora','ONLINE',40,null::integer,null,'NONE'),
    ('CUR-00028','Mediador Escolar','ONLINE',10,null::integer,null,'NONE'),
    ('CUR-00029','NR-10','ONLINE',40,null::integer,null,'NONE'),
    ('CUR-00030','NR-33','ONLINE',16,null::integer,null,'NONE'),
    ('CUR-00031','NR-34','ONLINE',16,null::integer,null,'NONE'),
    ('CUR-00032','NR-35','ONLINE',16,null::integer,null,'NONE'),
    ('CUR-00033','Operador de Empilhadeira','ONLINE',30,null::integer,null,'NONE'),
    ('CUR-00034','Pá Carregadeira','ONLINE',25,null::integer,null,'NONE'),
    ('CUR-00035','Ponte Rolante','ONLINE',80,null::integer,null,'NONE'),
    ('CUR-00036','Retroescavadeira','ONLINE',25,null::integer,null,'NONE'),
    ('CUR-00037','Socorrista APH','ONLINE',24,null::integer,null,'NONE'),
    ('CUR-00038','Eletricista','ONLINE',60,null::integer,null,'NONE'),
    ('CUR-00039','TBO - Treinamento Básico Operacional','ONLINE',35,null::integer,null,'NONE'),
    ('CUR-00040','Administração de Empresas','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00041','Agente de Portaria','ONLINE',15,null::integer,null,'NONE'),
    ('CUR-00042','Almoxarifado','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00043','Atendente de Farmácia','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00044','Conhecimentos Bancários','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00045','Contabilidade','ONLINE',22,null::integer,null,'NONE'),
    ('CUR-00046','Departamento Pessoal','ONLINE',100,null::integer,null,'NONE'),
    ('CUR-00047','Elaboração de Currículo','ONLINE',3,null::integer,null,'NONE'),
    ('CUR-00048','Empreendedorismo','ONLINE',100,null::integer,null,'NONE'),
    ('CUR-00049','Gestão em RH','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00050','Hotelaria e Turismo','ONLINE',30,null::integer,null,'NONE'),
    ('CUR-00051','Instagram para Vendas','ONLINE',4,null::integer,null,'NONE'),
    ('CUR-00052','Investimento Mercado Financeiro','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00053','Logística 4.0','ONLINE',50,null::integer,null,'NONE'),
    ('CUR-00054','Marketing Digital','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00055','Matemática Financeira','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00056','Mídias Sociais','ONLINE',4,null::integer,null,'NONE'),
    ('CUR-00057','Operador de Caixa','ONLINE',30,null::integer,null,'NONE'),
    ('CUR-00058','Supervisão Pedagógica','ONLINE',60,null::integer,null,'NONE'),
    ('CUR-00059','Técnicas de Vendas','ONLINE',20,null::integer,null,'NONE'),
    ('CUR-00060','Telemarketing','ONLINE',18,null::integer,null,'NONE'),
    ('CUR-00061','Oratória','ONLINE',30,null::integer,null,'NONE'),
    ('CUR-00062','Jornalismo','ONLINE',75,null::integer,null,'NONE'),
    ('CUR-00063','Corretor de Imóveis','ONLINE',60,null::integer,null,'NONE'),
    ('CUR-00064','Estoque e Faturamento','ONLINE',40,null::integer,null,'NONE'),
    ('CUR-00065','Solda MIG/MAG','ONLINE',32,null::integer,null,'NONE'),
    ('CUR-00066','Solda TIG','ONLINE',30,null::integer,null,'NONE')
  ) as expected(code,name,modality,workload_hours,duration_value,duration_unit,business_review_status)
  loop
    select * into v_course from public.courses where code = r.code;
    if not found then raise exception 'Missing expected course %', r.code; end if;
    if v_course.name <> r.name
       or v_course.modality <> r.modality
       or v_course.workload_hours is distinct from r.workload_hours
       or v_course.duration_value is distinct from r.duration_value
       or v_course.duration_unit is distinct from r.duration_unit
       or v_course.business_review_status <> r.business_review_status
       or v_course.default_price is not null
    then
      raise exception 'Unexpected catalog data for %', r.code;
    end if;
  end loop;

  select count(*) into v_online from public.courses where code between 'CUR-00012' and 'CUR-00066' and modality = 'ONLINE';
  select count(*) into v_regular from public.courses where code between 'CUR-00001' and 'CUR-00011' and modality = 'PRESENCIAL';
  select count(*) into v_total from public.courses where code between 'CUR-00001' and 'CUR-00066';

  if v_online <> 55 then raise exception 'Expected 55 online courses, got %', v_online; end if;
  if v_regular <> 11 then raise exception 'Expected 11 regular courses, got %', v_regular; end if;
  if v_total <> 66 then raise exception 'Expected 66 official courses, got %', v_total; end if;
  if (select count(distinct code) from public.courses where code between 'CUR-00001' and 'CUR-00066') <> 66 then
    raise exception 'Official course codes are not unique';
  end if;
  if exists (select 1 from public.courses where code between 'CUR-00001' and 'CUR-00066' and default_price is not null) then
    raise exception 'Initial catalog must not save prices in courses';
  end if;
  if exists (select 1 from public.courses where code between 'CUR-00001' and 'CUR-00066' and name like '% + %' and business_review_status <> 'NEEDS_BUSINESS_REVIEW') then
    raise exception 'Commercial package must be marked for business review';
  end if;
  if (select count(*) from public.courses where code between 'CUR-00001' and 'CUR-00066' and name ilike '%combo%') <> 0 then
    raise exception 'Combos must not be seeded as courses';
  end if;
  if (select count(*) from public.course_catalog_load_audit where expected_code like 'CUR-%') <> 66 then
    raise exception 'Expected 66 official audit records';
  end if;
  if exists (select 1 from public.course_catalog_load_audit where expected_code like 'CUR-%' and classification not in ('NEW','MATCH')) then
    raise exception 'Official catalog contains an unresolved code conflict';
  end if;
  if exists (select 1 from public.courses where code between 'CUR-00001' and 'CUR-00066' and name ilike any(array[
    '%Cabeleireiro + Estética%', '%Cabeleireiro + Barbeiro%', '%Estética + Barbeiro%', '%Farmácia + Necropsia%',
    '%Cursos Técnicos EAD%', '%Certificação Técnica por Competência%', '%EJA EAD%', '%Módulo de Estética%', '%Módulo de Máquinas%', '%Massoterapia VIP%'
  ])) then
    raise exception 'Excluded commercial products must not be courses';
  end if;
end $$;
