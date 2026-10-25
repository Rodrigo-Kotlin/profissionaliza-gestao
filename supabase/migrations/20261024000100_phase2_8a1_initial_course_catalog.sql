-- FASE 2.8A.1 — Catálogo inicial de cursos Profissionaliza
-- Carga controlada, idempotente e sem preços/matrizes/combos.
begin;

-- O status existente é o equivalente canônico a active. Mantemos os valores
-- atuais para não quebrar referências nem alterar registros existentes.
alter table public.courses drop constraint if exists courses_modality_check;
alter table public.courses add constraint courses_modality_check
  check (modality in ('PRESENCIAL','ONLINE','EAD','HIBRIDO','OUTRO'));

-- Registra pendências comerciais sem misturá-las com modalidade, duração ou preço.
alter table public.courses add column if not exists business_review_status text not null default 'NONE';
alter table public.courses drop constraint if exists courses_business_review_status_check;
alter table public.courses add constraint courses_business_review_status_check
  check (business_review_status in ('NONE','NEEDS_BUSINESS_REVIEW'));

-- Auditoria da carga: uma linha por código oficial e uma linha por curso legado.
create table if not exists public.course_catalog_load_audit (
  expected_code text primary key,
  expected_name text not null,
  classification text not null check (classification in ('MATCH','NEW','CONFLICT','LEGACY')),
  existing_course_id uuid references public.courses(id) on delete set null,
  audited_at timestamptz not null default now()
);
alter table public.course_catalog_load_audit enable row level security;
revoke all on table public.course_catalog_load_audit from public, anon, authenticated;

-- Seed oficial de abril/2026. A ausência de default_price é intencional.
do $$
declare
  r record;
  v_existing public.courses%rowtype;
  v_id uuid;
  v_classification text;
  v_before integer;
  v_matches integer := 0;
  v_new integer := 0;
  v_conflicts integer := 0;
begin
  select count(*) into v_before from public.courses;
  for r in
    select * from (values
      ('CUR-00001','Estética e Beleza','PRESENCIAL',null::integer,10,'MONTHS','REGULAR','NONE'),
      ('CUR-00002','Cabeleireiro','PRESENCIAL',null::integer,8,'MONTHS','REGULAR','NONE'),
      ('CUR-00003','Barbeiro','PRESENCIAL',null::integer,7,'MONTHS','REGULAR','NONE'),
      ('CUR-00004','Atendente de Farmácia','PRESENCIAL',null::integer,10,'MONTHS','REGULAR','NONE'),
      ('CUR-00005','Máquinas Pesadas','PRESENCIAL',null::integer,5,'MONTHS','REGULAR','NONE'),
      ('CUR-00006','Auxiliar de Necropsia','PRESENCIAL',null::integer,10,'MONTHS','REGULAR','NONE'),
      ('CUR-00007','Eletricista Predial ou Refrigeração','PRESENCIAL',null::integer,5,'MONTHS','REGULAR','NEEDS_BUSINESS_REVIEW'),
      ('CUR-00008','Massoterapia','PRESENCIAL',null::integer,5,'MONTHS','REGULAR','NONE'),
      ('CUR-00009','Pacote Industrial Eletricista + Refrigeração','PRESENCIAL',null::integer,10,'MONTHS','REGULAR','NEEDS_BUSINESS_REVIEW'),
      ('CUR-00010','Frentista NR-20','PRESENCIAL',null::integer,3,'DAYS','REGULAR','NONE'),
      ('CUR-00011','Recepcionista de Clínicas','PRESENCIAL',null::integer,4,'DAYS','REGULAR','NONE'),
      ('CUR-00012','Auxiliar em Radiologia','ONLINE',40,null::integer,null,'ONLINE','NONE'),
      ('CUR-00013','Auxiliar de Creche','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00014','Auxiliar de Necrópsia','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00015','Auxiliar de Veterinário','ONLINE',80,null::integer,null,'ONLINE','NONE'),
      ('CUR-00016','Auxiliar em Análises Clínicas','ONLINE',60,null::integer,null,'ONLINE','NONE'),
      ('CUR-00017','Barbeiro Profissional','ONLINE',80,null::integer,null,'ONLINE','NONE'),
      ('CUR-00018','Cuidador de Idoso','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00019','Designer de Cílios & Sobrancelha','ONLINE',15,null::integer,null,'ONLINE','NONE'),
      ('CUR-00020','Instalador de Energia Solar','ONLINE',80,null::integer,null,'ONLINE','NONE'),
      ('CUR-00021','Agente Comunitário de Saúde','ONLINE',80,null::integer,null,'ONLINE','NONE'),
      ('CUR-00022','Teologia Histórica','ONLINE',100,null::integer,null,'ONLINE','NONE'),
      ('CUR-00023','Fiscal de Loja','ONLINE',10,null::integer,null,'ONLINE','NONE'),
      ('CUR-00024','Frentista Profissional','ONLINE',40,null::integer,null,'ONLINE','NONE'),
      ('CUR-00025','Manicure e Pedicure','ONLINE',50,null::integer,null,'ONLINE','NONE'),
      ('CUR-00026','Maquiagem','ONLINE',15,null::integer,null,'ONLINE','NONE'),
      ('CUR-00027','Massagem Modeladora','ONLINE',40,null::integer,null,'ONLINE','NONE'),
      ('CUR-00028','Mediador Escolar','ONLINE',10,null::integer,null,'ONLINE','NONE'),
      ('CUR-00029','NR-10','ONLINE',40,null::integer,null,'ONLINE','NONE'),
      ('CUR-00030','NR-33','ONLINE',16,null::integer,null,'ONLINE','NONE'),
      ('CUR-00031','NR-34','ONLINE',16,null::integer,null,'ONLINE','NONE'),
      ('CUR-00032','NR-35','ONLINE',16,null::integer,null,'ONLINE','NONE'),
      ('CUR-00033','Operador de Empilhadeira','ONLINE',30,null::integer,null,'ONLINE','NONE'),
      ('CUR-00034','Pá Carregadeira','ONLINE',25,null::integer,null,'ONLINE','NONE'),
      ('CUR-00035','Ponte Rolante','ONLINE',80,null::integer,null,'ONLINE','NONE'),
      ('CUR-00036','Retroescavadeira','ONLINE',25,null::integer,null,'ONLINE','NONE'),
      ('CUR-00037','Socorrista APH','ONLINE',24,null::integer,null,'ONLINE','NONE'),
      ('CUR-00038','Eletricista','ONLINE',60,null::integer,null,'ONLINE','NONE'),
      ('CUR-00039','TBO - Treinamento Básico Operacional','ONLINE',35,null::integer,null,'ONLINE','NONE'),
      ('CUR-00040','Administração de Empresas','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00041','Agente de Portaria','ONLINE',15,null::integer,null,'ONLINE','NONE'),
      ('CUR-00042','Almoxarifado','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00043','Atendente de Farmácia','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00044','Conhecimentos Bancários','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00045','Contabilidade','ONLINE',22,null::integer,null,'ONLINE','NONE'),
      ('CUR-00046','Departamento Pessoal','ONLINE',100,null::integer,null,'ONLINE','NONE'),
      ('CUR-00047','Elaboração de Currículo','ONLINE',3,null::integer,null,'ONLINE','NONE'),
      ('CUR-00048','Empreendedorismo','ONLINE',100,null::integer,null,'ONLINE','NONE'),
      ('CUR-00049','Gestão em RH','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00050','Hotelaria e Turismo','ONLINE',30,null::integer,null,'ONLINE','NONE'),
      ('CUR-00051','Instagram para Vendas','ONLINE',4,null::integer,null,'ONLINE','NONE'),
      ('CUR-00052','Investimento Mercado Financeiro','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00053','Logística 4.0','ONLINE',50,null::integer,null,'ONLINE','NONE'),
      ('CUR-00054','Marketing Digital','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00055','Matemática Financeira','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00056','Mídias Sociais','ONLINE',4,null::integer,null,'ONLINE','NONE'),
      ('CUR-00057','Operador de Caixa','ONLINE',30,null::integer,null,'ONLINE','NONE'),
      ('CUR-00058','Supervisão Pedagógica','ONLINE',60,null::integer,null,'ONLINE','NONE'),
      ('CUR-00059','Técnicas de Vendas','ONLINE',20,null::integer,null,'ONLINE','NONE'),
      ('CUR-00060','Telemarketing','ONLINE',18,null::integer,null,'ONLINE','NONE'),
      ('CUR-00061','Oratória','ONLINE',30,null::integer,null,'ONLINE','NONE'),
      ('CUR-00062','Jornalismo','ONLINE',75,null::integer,null,'ONLINE','NONE'),
      ('CUR-00063','Corretor de Imóveis','ONLINE',60,null::integer,null,'ONLINE','NONE'),
      ('CUR-00064','Estoque e Faturamento','ONLINE',40,null::integer,null,'ONLINE','NONE'),
      ('CUR-00065','Solda MIG/MAG','ONLINE',32,null::integer,null,'ONLINE','NONE'),
      ('CUR-00066','Solda TIG','ONLINE',30,null::integer,null,'ONLINE','NONE')
    ) as seed(code,name,modality,workload_hours,duration_value,duration_unit,category,business_review_status)
  loop
    select * into v_existing from public.courses where code = r.code;
    if found then
      v_id := v_existing.id;
      if v_existing.name = r.name
         and v_existing.modality = r.modality
         and v_existing.workload_hours is not distinct from r.workload_hours
         and v_existing.duration_value is not distinct from r.duration_value
         and v_existing.duration_unit is not distinct from r.duration_unit
      then v_classification := 'MATCH';
      else v_classification := 'CONFLICT';
      end if;
    else
      insert into public.courses (
        code, name, category, modality, workload_hours, duration_value,
        duration_unit, status, business_review_status
      ) values (
        r.code, r.name, r.category, r.modality, r.workload_hours,
        r.duration_value, r.duration_unit, 'ACTIVE', r.business_review_status
      ) returning id into v_id;
      v_classification := 'NEW';
    end if;
    if v_classification = 'MATCH' then v_matches := v_matches + 1; end if;
    if v_classification = 'NEW' then v_new := v_new + 1; end if;
    if v_classification = 'CONFLICT' then v_conflicts := v_conflicts + 1; end if;

    insert into public.course_catalog_load_audit(expected_code, expected_name, classification, existing_course_id)
    values (r.code, r.name, v_classification, v_id)
    on conflict (expected_code) do update set
      expected_name = excluded.expected_name,
      classification = excluded.classification,
      existing_course_id = excluded.existing_course_id,
      audited_at = now();
  end loop;

  insert into public.course_catalog_load_audit(expected_code, expected_name, classification, existing_course_id)
  select 'LEGACY:' || c.code, c.name, 'LEGACY', c.id
  from public.courses c
  where not exists (select 1 from public.course_catalog_load_audit a where a.existing_course_id = c.id)
  on conflict (expected_code) do nothing;

  raise notice 'Phase 2.8A.1 catalog: before=%, after=%, inserted=%, matched=%, conflicts=%, legacy=%',
    v_before,
    (select count(*) from public.courses),
    v_new,
    v_matches,
    v_conflicts,
    (select count(*) from public.course_catalog_load_audit where classification = 'LEGACY');
end $$;

-- Mantém o retorno da tela compatível com o novo marcador de revisão.
create or replace function public.list_courses(p_status text default 'ACTIVE')
returns json language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
declare v_rows json;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('courses.view') then raise exception 'Permission denied: courses.view' using errcode = '42501'; end if;
  v_rows := coalesce(json_agg(row order by c.name), '[]'::json)
  from (
    select c.id,c.code,c.name,c.short_name,c.category,c.modality,c.workload_hours,
      c.duration_value,c.duration_unit,c.default_price,c.status,c.business_review_status
    from public.courses c where (p_status is null or c.status = p_status) order by c.name
  ) c;
  return v_rows;
end $$;

-- RPC validation must accept every initial modality while preserving RPC-only access.
create or replace function public.create_course(
  p_code text, p_name text, p_short_name text default null, p_category text default null,
  p_modality text default 'PRESENCIAL', p_workload_hours integer default null,
  p_duration_value integer default null, p_duration_unit text default null,
  p_default_price numeric default null, p_description text default null
) returns uuid language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
declare v_course_id uuid; v_normalized_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('courses.manage') then raise exception 'Permission denied: courses.manage' using errcode = '42501'; end if;
  v_normalized_code := upper(trim(p_code));
  if v_normalized_code is null or char_length(v_normalized_code) = 0 then raise exception 'Course code is required' using errcode = '22023'; end if;
  if p_name is null or char_length(trim(p_name)) = 0 then raise exception 'Course name is required' using errcode = '22023'; end if;
  if p_modality not in ('PRESENCIAL','ONLINE','EAD','HIBRIDO','OUTRO') then raise exception 'Invalid modality' using errcode = '22023'; end if;
  insert into public.courses(code,name,short_name,category,modality,workload_hours,duration_value,duration_unit,default_price,description,created_by,updated_by)
  values(v_normalized_code,trim(p_name),nullif(trim(coalesce(p_short_name,'')),''),nullif(trim(coalesce(p_category,'')),''),p_modality,p_workload_hours,p_duration_value,nullif(trim(coalesce(p_duration_unit,'')),''),p_default_price,nullif(trim(coalesce(p_description,'')),''),auth.uid(),auth.uid()) returning id into v_course_id;
  perform public.write_audit_log('crm.course_created','course',v_course_id::text,jsonb_build_object('code',v_normalized_code,'name',p_name));
  return v_course_id;
end $$;

create or replace function public.update_course(
  p_course_id uuid, p_name text default null, p_short_name text default null, p_category text default null,
  p_modality text default null, p_workload_hours integer default null, p_duration_value integer default null,
  p_duration_unit text default null, p_default_price numeric default null, p_description text default null,
  p_status text default null
) returns void language plpgsql security definer set search_path = pg_catalog, public set row_security = off as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_permission('courses.manage') then raise exception 'Permission denied: courses.manage' using errcode = '42501'; end if;
  if not exists(select 1 from public.courses where id=p_course_id) then raise exception 'Course not found' using errcode='P0002'; end if;
  if p_modality is not null and p_modality not in ('PRESENCIAL','ONLINE','EAD','HIBRIDO','OUTRO') then raise exception 'Invalid modality' using errcode='22023'; end if;
  if p_status is not null and p_status not in ('DRAFT','ACTIVE','INACTIVE','ARCHIVED') then raise exception 'Invalid course status' using errcode='22023'; end if;
  update public.courses set name=coalesce(p_name,name),short_name=coalesce(p_short_name,short_name),category=coalesce(p_category,category),modality=coalesce(p_modality,modality),workload_hours=coalesce(p_workload_hours,workload_hours),duration_value=coalesce(p_duration_value,duration_value),duration_unit=coalesce(p_duration_unit,duration_unit),default_price=coalesce(p_default_price,default_price),description=coalesce(p_description,description),status=coalesce(p_status,status),updated_by=auth.uid() where id=p_course_id;
  perform public.write_audit_log('crm.course_updated','course',p_course_id::text,jsonb_build_object());
end $$;

commit;
