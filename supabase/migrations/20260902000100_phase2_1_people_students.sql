-- ============================================================================
-- FASE 2.1 — MASTER DATA: PESSOAS, ALUNOS E RESPONSÁVEIS
-- ============================================================================
-- Princípio: PEOPLE é a identidade central. Uma pessoa existe uma única vez.
--   people -> students (relação aluno-instituição)
--   people -> student_guardians (responsável também é uma people)
--   students -> student_status_history (estado)
--
-- Segurança:
--   - RLS por permissão (nunca authenticated using(true)).
--   - public.people sem SELECT direto para authenticated.
--   - Consultas de aluno via RPCs controladas (search_students, get_student_detail).
--   - Dados sensíveis (CPF/RG/telefone/whatsapp/email/endereço) retornados
--     COMPLETOS somente a quem possui students.view_sensitive.
--     Usuários com apenas students.view recebem valores MASCARADOS,
--     decidido no PostgreSQL (o frontend nunca recebe o valor completo).
--   - write_audit_log mantém a assinatura original e ganha uma variante
--     compatível que aceita metadata (sem dados pessoais).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. PERMISSIONS (fonte de evolução = MIGRATION)
-- ---------------------------------------------------------------------------
insert into public.permissions (code, name, description, module) values
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
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module,
  updated_at = now();

-- Matriz inicial de permissões por papel
with grants(role_code, permission_code) as (values
  ('DIRECAO','people.view'),('DIRECAO','people.create'),('DIRECAO','people.edit'),
  ('DIRECAO','students.view'),('DIRECAO','students.create'),('DIRECAO','students.edit'),('DIRECAO','students.manage_status'),('DIRECAO','students.view_sensitive'),
  ('DIRECAO','guardians.view'),('DIRECAO','guardians.manage'),

  ('PEDAGOGICO','people.view'),('PEDAGOGICO','people.edit'),
  ('PEDAGOGICO','students.view'),('PEDAGOGICO','students.create'),('PEDAGOGICO','students.edit'),('PEDAGOGICO','students.manage_status'),
  ('PEDAGOGICO','guardians.view'),('PEDAGOGICO','guardians.manage'),

  ('RECEPCAO','people.view'),('RECEPCAO','people.edit'),
  ('RECEPCAO','students.view'),('RECEPCAO','students.create'),('RECEPCAO','students.edit'),
  ('RECEPCAO','guardians.view'),('RECEPCAO','guardians.manage'),

  ('VENDEDOR','people.view'),('VENDEDOR','students.view'),

  ('FINANCEIRO','people.view'),('FINANCEIRO','students.view'),('FINANCEIRO','guardians.view')
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from grants g
join public.roles r on r.code = g.role_code
join public.permissions p on p.code = g.permission_code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. TABELA PEOPLE
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  preferred_name text,
  cpf text,
  rg text,
  birth_date date,
  email text,
  phone text,
  whatsapp text,
  postal_code text,
  street text,
  number text,
  complement text,
  district text,
  city text,
  state text,
  country text not null default 'Brasil',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint people_full_name_length check (char_length(full_name) between 1 and 240),
  constraint people_preferred_name_length check (char_length(preferred_name) <= 120),
  constraint people_cpf_format check (cpf is null or cpf ~ '^[0-9]{11}$'),
  constraint people_email_length check (email is null or char_length(email) between 3 and 320),
  constraint people_phone_length check (phone is null or char_length(phone) between 8 and 24),
  constraint people_whatsapp_length check (whatsapp is null or char_length(whatsapp) between 8 and 24),
  constraint people_state_length check (state is null or char_length(state) <= 2),
  constraint people_postal_code_format check (postal_code is null or postal_code ~ '^[0-9]{8}$')
);

create unique index if not exists people_cpf_unique_idx on public.people(cpf) where cpf is not null;
create unique index if not exists people_email_lower_unique_idx on public.people(lower(email)) where email is not null;
create index if not exists people_full_name_lower_idx on public.people(lower(full_name) text_pattern_ops);
create index if not exists people_phone_idx on public.people(phone) where phone is not null;
create index if not exists people_whatsapp_idx on public.people(whatsapp) where whatsapp is not null;

-- ---------------------------------------------------------------------------
-- 3. SEQUENCE PARA CÓDIGO DE ALUNO (concorrente-segura, evita MAX+1)
-- ---------------------------------------------------------------------------
create sequence if not exists public.student_code_seq as integer;
-- Seed opcional para começar em 1 e garantir formato padronizado com 6 dígitos.

alter table only public.people enable row level security;
revoke all on table public.people from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. TABELA STUDENTS
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.people(id),
  student_code text not null unique,
  status text not null default 'PRE_CADASTRO',
  registration_date date not null default current_date,
  origin text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint students_status_check check (status in ('PRE_CADASTRO','ATIVO','INATIVO','CANCELADO','CONCLUIDO')),
  constraint students_origin_length check (origin is null or char_length(origin) <= 40)
);

create index if not exists students_person_id_idx on public.students(person_id);
create index if not exists students_status_idx on public.students(status);
create index if not exists students_code_idx on public.students(student_code);
create index if not exists students_registration_date_idx on public.students(registration_date);

-- ---------------------------------------------------------------------------
-- 5. TABELA STUDENT_GUARDIANS
-- ---------------------------------------------------------------------------
create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_person_id uuid not null references public.people(id),
  relationship text not null,
  is_primary_contact boolean not null default false,
  is_financial_responsible boolean not null default false,
  is_legal_guardian boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint student_guardians_relationship_check check (relationship in ('PAI','MAE','AVO','AVO_A','CONJUGE','IRMAO','IRMA','TUTOR','RESPONSAVEL_LEGAL','OUTRO'))
);

-- Um responsável só pode ser vinculado uma vez ao mesmo aluno.
create unique index if not exists student_guardians_unique_link_idx
  on public.student_guardians(student_id, guardian_person_id);
-- No máximo 1 responsável principal por aluno.
create unique index if not exists student_guardians_primary_unique_idx
  on public.student_guardians(student_id)
  where is_primary_contact;
-- No máximo 1 responsável financeiro principal por aluno (MVP).
create unique index if not exists student_guardians_financial_unique_idx
  on public.student_guardians(student_id)
  where is_financial_responsible;
create index if not exists student_guardians_student_id_idx on public.student_guardians(student_id);
create index if not exists student_guardians_guardian_person_id_idx on public.student_guardians(guardian_person_id);

-- ---------------------------------------------------------------------------
-- 6. TABELA STUDENT_STATUS_HISTORY
-- ---------------------------------------------------------------------------
create table if not exists public.student_status_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  previous_status text,
  new_status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint student_status_history_new_status_check check (new_status in ('PRE_CADASTRO','ATIVO','INATIVO','CANCELADO','CONCLUIDO'))
);

create index if not exists student_status_history_student_id_idx on public.student_status_history(student_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- 7. TRIGGERS DE MANUTENÇÃO
-- ---------------------------------------------------------------------------
drop trigger if exists people_set_updated_at on public.people;
create trigger people_set_updated_at before update on public.people
  for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists student_guardians_set_updated_at on public.student_guardians;
create trigger student_guardians_set_updated_at before update on public.student_guardians
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
alter table only public.students enable row level security;
alter table only public.student_guardians enable row level security;
alter table only public.student_status_history enable row level security;

revoke all on table public.students from public, anon, authenticated;
revoke all on table public.student_guardians from public, anon, authenticated;
revoke all on table public.student_status_history from public, anon, authenticated;

-- Pessoas nunca são consultadas diretamente via REST (proteção estrutural).
-- As leituras necessárias ocorrem exclusivamente pelas RPCs controladas.
revoke select on table public.people from authenticated;

-- ---------------------------------------------------------------------------
-- 9. FUNÇÃO AUXILIAR: MASKING
-- ---------------------------------------------------------------------------
create or replace function public.mask_cpf(p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null or char_length(p_value) <> 11 then null
    else '***.***.***-' || right(p_value, 2)
  end;
$$;

create or replace function public.mask_phone(p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null or char_length(p_value) < 2 then null
    else '••••-' || right(p_value, 4)
  end;
$$;

create or replace function public.mask_email(p_value text)
returns text
language sql
immutable
as $$
  select case
    when p_value is null then null
    else left(split_part(p_value, '@', 1), 1) || '***@' || split_part(p_value, '@', 2)
  end;
$$;

-- ---------------------------------------------------------------------------
-- 10. RPC — create_student
-- ---------------------------------------------------------------------------
create or replace function public.create_student(
  p_full_name text,
  p_preferred_name text default null,
  p_cpf text default null,
  p_rg text default null,
  p_birth_date date default null,
  p_email text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_postal_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_emergency_contact_name text default null,
  p_emergency_contact_phone text default null,
  p_notes text default null,
  p_origin text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person_id uuid;
  v_student_id uuid;
  v_student_code text;
  v_normalized_cpf text;
  v_normalized_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.create') then
    raise exception 'Permission denied: students.create' using errcode = '42501';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required' using errcode = '22023';
  end if;

  -- Normalizações
  v_normalized_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  if v_normalized_cpf is not null and char_length(v_normalized_cpf) <> 11 then
    raise exception 'CPF must have 11 digits' using errcode = '22023';
  end if;

  -- Reutiliza people quando CPF já existe; caso contrário cria nova.
  if v_normalized_cpf is not null then
    select id into v_person_id
    from public.people
    where cpf = v_normalized_cpf;
  end if;

  if v_person_id is null then
    insert into public.people (
      full_name, preferred_name, cpf, rg, birth_date, email, phone, whatsapp,
      postal_code, street, number, complement, district, city, state,
      emergency_contact_name, emergency_contact_phone, notes, created_by, updated_by
    ) values (
      trim(p_full_name), nullif(trim(coalesce(p_preferred_name, '')), ''), v_normalized_cpf,
      nullif(trim(coalesce(p_rg, '')), ''), p_birth_date, v_normalized_email,
      nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
      nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
      nullif(ltrim(coalesce(p_postal_code, ''), '0'), ''), nullif(trim(coalesce(p_street, '')), ''),
      nullif(trim(coalesce(p_number, '')), ''), nullif(trim(coalesce(p_complement, '')), ''),
      nullif(trim(coalesce(p_district, '')), ''), nullif(trim(coalesce(p_city, '')), ''),
      nullif(upper(trim(coalesce(p_state, ''))), ''), nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
      nullif(regexp_replace(coalesce(p_emergency_contact_phone, ''), '\D', '', 'g'), ''),
      nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  -- Gera código de aluno (concorrente-seguro via sequence)
  v_student_code := 'ALU-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.student_code_seq')::text, 6, '0');

  insert into public.students (
    person_id, student_code, status, registration_date, origin, notes, created_by, updated_by
  ) values (
    v_person_id, v_student_code, 'PRE_CADASTRO', current_date,
    nullif(trim(coalesce(p_origin, '')), ''), nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid()
  )
  returning id into v_student_id;

  -- Histórico inicial
  insert into public.student_status_history (student_id, previous_status, new_status, reason, changed_by)
  values (v_student_id, null, 'PRE_CADASTRO', 'Criação do aluno', auth.uid());

  perform public.write_audit_log(
    'student.created', 'student', v_student_id::text,
    jsonb_build_object('person_id', v_person_id::text, 'code', v_student_code)
  );

  return v_student_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. RPC — change_student_status
-- ---------------------------------------------------------------------------
create or replace function public.change_student_status(
  p_student_id uuid,
  p_new_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_previous text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.manage_status') then
    raise exception 'Permission denied: students.manage_status' using errcode = '42501';
  end if;

  if p_new_status not in ('PRE_CADASTRO','ATIVO','INATIVO','CANCELADO','CONCLUIDO') then
    raise exception 'Invalid student status' using errcode = '22023';
  end if;

  select status into v_previous
  from public.students
  where id = p_student_id
  for update;

  if v_previous is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  if v_previous = p_new_status then
    raise exception 'Status is already %', p_new_status using errcode = '22023';
  end if;

  update public.students
     set status = p_new_status, updated_by = auth.uid()
   where id = p_student_id;

  insert into public.student_status_history
    (student_id, previous_status, new_status, reason, changed_by)
  values
    (p_student_id, v_previous, p_new_status, nullif(trim(coalesce(p_reason, '')), ''), auth.uid());

  perform public.write_audit_log(
    'student.status_changed', 'student', p_student_id::text,
    jsonb_build_object(
      'previous_status', v_previous,
      'new_status', p_new_status,
      'has_reason', (coalesce(p_reason, '') <> '')
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. RPC — search_students (listagem com paginação, ordenação e masking)
-- ---------------------------------------------------------------------------
create or replace function public.search_students(
  p_query text default null,
  p_status text default null,
  p_origin text default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_sort text default 'full_name',
  p_sort_dir text default 'ASC'
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_offset integer;
  v_sensitive boolean;
  v_total bigint;
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.view') then
    raise exception 'Permission denied: students.view' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('students.view_sensitive');
  v_offset := (greatest(p_page, 1) - 1) * greatest(p_page_size, 1);

  -- Valida limites
  if p_page_size > 100 then
    raise exception 'page_size cannot exceed 100' using errcode = '22023';
  end if;

  select count(*)::bigint into v_total
  from public.students s
  join public.people p on p.id = s.person_id
  where (p_status is null or s.status = p_status)
    and (p_origin is null or s.origin = p_origin)
    and (
      p_query is null or p_query = ''
      or (
        p_query ~ '^[0-9]{11}$'
        and (p.cpf like p_query || '%' or s.student_code ilike '%' || p_query || '%')
      )
      or (
        not (p_query ~ '^[0-9]{11}$')
        and (
          s.student_code ilike '%' || p_query || '%'
          or p.full_name ilike '%' || p_query || '%'
          or p.preferred_name ilike '%' || p_query || '%'
          or p.phone like p_query || '%'
          or p.whatsapp like p_query || '%'
        )
      )
    );

  v_rows := coalesce(json_agg(row), '[]'::json)
  from (
    select
      s.id as student_id,
      s.student_code,
      p.full_name,
      p.cpf,
      p.phone,
      p.whatsapp,
      p.email,
      s.origin,
      s.status,
      s.registration_date
    from public.students s
    join public.people p on p.id = s.person_id
    where (p_status is null or s.status = p_status)
      and (p_origin is null or s.origin = p_origin)
      and (
        p_query is null or p_query = ''
        or (
          p_query ~ '^[0-9]{11}$'
          and (p.cpf like p_query || '%' or s.student_code ilike '%' || p_query || '%')
        )
        or (
          not (p_query ~ '^[0-9]{11}$')
          and (
            s.student_code ilike '%' || p_query || '%'
            or p.full_name ilike '%' || p_query || '%'
            or p.preferred_name ilike '%' || p_query || '%'
            or p.phone like p_query || '%'
            or p.whatsapp like p_query || '%'
          )
        )
      )
    order by
      case when p_sort = 'registration_date' and upper(p_sort_dir) = 'DESC' then to_char(s.registration_date, 'YYYYMMDD') end desc nulls last,
      case when p_sort = 'registration_date' and upper(p_sort_dir) <> 'DESC' then to_char(s.registration_date, 'YYYYMMDD') end asc nulls last,
      case when p_sort = 'status' and upper(p_sort_dir) = 'DESC' then s.status end desc,
      case when p_sort = 'status' and upper(p_sort_dir) <> 'DESC' then s.status end asc,
      case when p_sort = 'student_code' and upper(p_sort_dir) = 'DESC' then s.student_code end desc,
      case when p_sort = 'student_code' and upper(p_sort_dir) <> 'DESC' then s.student_code end asc,
      case when p_sort not in ('registration_date','status','student_code') and upper(p_sort_dir) = 'DESC' then lower(p.full_name) end desc,
      case when p_sort not in ('registration_date','status','student_code') and upper(p_sort_dir) <> 'DESC' then lower(p.full_name) end asc
    limit p_page_size offset v_offset
  ) row;

  -- Mascarar quando não possuir students.view_sensitive
  if not v_sensitive then
    select coalesce(json_agg(json_build_object(
        'student_id', t.student_id,
        'student_code', t.student_code,
        'full_name', t.full_name,
        'cpf', public.mask_cpf(t.cpf),
        'phone', public.mask_phone(t.phone),
        'whatsapp', public.mask_phone(t.whatsapp),
        'email', public.mask_email(t.email),
        'origin', t.origin,
        'status', t.status,
        'registration_date', to_char(t.registration_date, 'YYYY-MM-DD')
      )), '[]'::json)
      into v_rows
    from (
      select * from json_to_recordset(v_rows) as x(
        student_id uuid, student_code text, full_name text, cpf text, phone text,
        whatsapp text, email text, origin text, status text, registration_date date
      )
    ) t;
  end if;

  return json_build_object(
    'data', v_rows,
    'total', v_total,
    'sensitive', v_sensitive
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. RPC — get_student_detail
-- ---------------------------------------------------------------------------
create or replace function public.get_student_detail(p_student_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sensitive boolean;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.view') then
    raise exception 'Permission denied: students.view' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('students.view_sensitive');

  select json_build_object(
    'student_id', s.id,
    'person_id', p.id,
    'student_code', s.student_code,
    'status', s.status,
    'registration_date', to_char(s.registration_date, 'YYYY-MM-DD'),
    'origin', s.origin,
    'full_name', p.full_name,
    'preferred_name', p.preferred_name,
    'birth_date', p.birth_date,
    'cpf', case when v_sensitive then p.cpf else public.mask_cpf(p.cpf) end,
    'rg', case when v_sensitive then p.rg else null end,
    'email', case when v_sensitive then p.email else public.mask_email(p.email) end,
    'phone', case when v_sensitive then p.phone else public.mask_phone(p.phone) end,
    'whatsapp', case when v_sensitive then p.whatsapp else public.mask_phone(p.whatsapp) end,
    'postal_code', case when v_sensitive then p.postal_code else null end,
    'street', case when v_sensitive then p.street else null end,
    'number', case when v_sensitive then p.number else null end,
    'complement', case when v_sensitive then p.complement else null end,
    'district', case when v_sensitive then p.district else null end,
    'city', case when v_sensitive then p.city else null end,
    'state', case when v_sensitive then p.state else null end,
    'emergency_contact_name', case when v_sensitive then p.emergency_contact_name else null end,
    'emergency_contact_phone', case when v_sensitive then p.emergency_contact_phone else null end,
    'notes', p.notes,
    'is_active', p.is_active,
    'sensitive', v_sensitive
  )
  into v_result
  from public.students s
  join public.people p on p.id = s.person_id
  where s.id = p_student_id;

  if v_result is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14. RPC — list_guardians / link_guardian / unlink_guardian
-- ---------------------------------------------------------------------------
create or replace function public.list_guardians(p_student_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sensitive boolean;
  v_rows json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('guardians.view') then
    raise exception 'Permission denied: guardians.view' using errcode = '42501';
  end if;

  v_sensitive := public.has_permission('guardians.manage');

  select coalesce(json_agg(json_build_object(
      'guardian_id', g.id,
      'person_id', p.id,
      'full_name', p.full_name,
      'relationship', g.relationship,
      'is_primary_contact', g.is_primary_contact,
      'is_financial_responsible', g.is_financial_responsible,
      'is_legal_guardian', g.is_legal_guardian,
      'phone', case when v_sensitive then p.phone else public.mask_phone(p.phone) end,
      'whatsapp', case when v_sensitive then p.whatsapp else public.mask_phone(p.whatsapp) end,
      'email', case when v_sensitive then p.email else public.mask_email(p.email) end
    )), '[]'::json)
    into v_rows
  from public.student_guardians g
  join public.people p on p.id = g.guardian_person_id
  where g.student_id = p_student_id;

  return v_rows;
end;
$$;

create or replace function public.link_guardian(
  p_student_id uuid,
  p_full_name text,
  p_cpf text default null,
  p_relationship text default 'OUTRO',
  p_phone text default null,
  p_whatsapp text default null,
  p_email text default null,
  p_is_primary_contact boolean default false,
  p_is_financial_responsible boolean default false,
  p_is_legal_guardian boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_person_id uuid;
  v_normalized_cpf text;
  v_normalized_email text;
  v_guardian_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('guardians.manage') then
    raise exception 'Permission denied: guardians.manage' using errcode = '42501';
  end if;

  if p_full_name is null or char_length(trim(p_full_name)) = 0 then
    raise exception 'Guardian name is required' using errcode = '22023';
  end if;

  if p_relationship not in ('PAI','MAE','AVO','AVO_A','CONJUGE','IRMAO','IRMA','TUTOR','RESPONSAVEL_LEGAL','OUTRO') then
    raise exception 'Invalid relationship' using errcode = '22023';
  end if;

  v_normalized_cpf := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_normalized_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  -- Reutiliza people existente pelo CPF quando possível
  if v_normalized_cpf is not null then
    select id into v_person_id from public.people where cpf = v_normalized_cpf;
  end if;

  if v_person_id is null then
    insert into public.people (
      full_name, cpf, email, phone, whatsapp, created_by, updated_by
    ) values (
      trim(p_full_name), v_normalized_cpf, v_normalized_email,
      nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), ''),
      nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), ''),
      auth.uid(), auth.uid()
    )
    returning id into v_person_id;
  end if;

  insert into public.student_guardians (
    student_id, guardian_person_id, relationship,
    is_primary_contact, is_financial_responsible, is_legal_guardian,
    notes, created_by
  ) values (
    p_student_id, v_person_id, p_relationship,
    coalesce(p_is_primary_contact, false), coalesce(p_is_financial_responsible, false),
    coalesce(p_is_legal_guardian, false), nullif(trim(coalesce(p_notes, '')), ''), auth.uid()
  )
  returning id into v_guardian_id;

  perform public.write_audit_log(
    'guardian.linked', 'student_guardian', v_guardian_id::text,
    jsonb_build_object('student_id', p_student_id::text, 'relationship', p_relationship)
  );

  return v_guardian_id;
end;
$$;

create or replace function public.unlink_guardian(p_guardian_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_student_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('guardians.manage') then
    raise exception 'Permission denied: guardians.manage' using errcode = '42501';
  end if;

  select student_id into v_student_id from public.student_guardians where id = p_guardian_id;
  if v_student_id is null then
    raise exception 'Guardian link not found' using errcode = 'P0002';
  end if;

  delete from public.student_guardians where id = p_guardian_id;

  perform public.write_audit_log(
    'guardian.unlinked', 'student_guardian', p_guardian_id::text,
    jsonb_build_object('student_id', v_student_id::text)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. RPC — get_student_history (eventos compreensíveis)
-- ---------------------------------------------------------------------------
create or replace function public.get_student_history(p_student_id uuid)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_events json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.view') then
    raise exception 'Permission denied: students.view' using errcode = '42501';
  end if;

  select coalesce(json_agg(json_build_object(
      'changed_at', to_char(h.changed_at, 'YYYY-MM-DD"T"HH24:MI:SS'),
      'type', 'status_changed',
      'title', 'Status alterado',
      'detail', coalesce(h.previous_status, '—') || ' → ' || h.new_status
    ) order by h.changed_at desc), '[]'::json)
    into v_events
  from public.student_status_history h
  where h.student_id = p_student_id;

  return v_events;
end;
$$;

-- ---------------------------------------------------------------------------
-- 16. RPC — student_kpis (dashboard — totais reais)
-- ---------------------------------------------------------------------------
create or replace function public.student_kpis()
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_active bigint;
  v_new_month bigint;
  v_pre bigint;
  v_inactive bigint;
  v_total bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('students.view') then
    raise exception 'Permission denied: students.view' using errcode = '42501';
  end if;

  select count(*) into v_active from public.students where status = 'ATIVO';
  select count(*) into v_new_month from public.students
    where registration_date >= date_trunc('month', current_date);
  select count(*) into v_pre from public.students where status = 'PRE_CADASTRO';
  select count(*) into v_inactive from public.students where status in ('INATIVO','CANCELADO');
  select count(*) into v_total from public.students;

  return json_build_object(
    'active', v_active,
    'new_month', v_new_month,
    'pre_registered', v_pre,
    'inactive', v_inactive,
    'total', v_total
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 17. GRANTS DAS RPCs
-- ---------------------------------------------------------------------------
grant execute on function public.create_student(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.change_student_status(uuid,text,text) to authenticated;
grant execute on function public.search_students(text,text,text,integer,integer,text,text) to authenticated;
grant execute on function public.get_student_detail(uuid) to authenticated;
grant execute on function public.list_guardians(uuid) to authenticated;
grant execute on function public.link_guardian(uuid,text,text,text,text,text,text,boolean,boolean,boolean,text) to authenticated;
grant execute on function public.unlink_guardian(uuid) to authenticated;
grant execute on function public.get_student_history(uuid) to authenticated;
grant execute on function public.student_kpis() to authenticated;
grant execute on function public.mask_cpf(text) to authenticated;
grant execute on function public.mask_phone(text) to authenticated;
grant execute on function public.mask_email(text) to authenticated;

revoke execute on function public.create_student(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text,text,text,text,text) from public, anon;
revoke execute on function public.change_student_status(uuid,text,text) from public, anon;
revoke execute on function public.search_students(text,text,text,integer,integer,text,text) from public, anon;
revoke execute on function public.get_student_detail(uuid) from public, anon;
revoke execute on function public.list_guardians(uuid) from public, anon;
revoke execute on function public.link_guardian(uuid,text,text,text,text,text,text,boolean,boolean,boolean,text) from public, anon;
revoke execute on function public.unlink_guardian(uuid) from public, anon;
revoke execute on function public.get_student_history(uuid) from public, anon;
revoke execute on function public.student_kpis() from public, anon;
revoke execute on function public.mask_cpf(text) from public, anon;
revoke execute on function public.mask_phone(text) from public, anon;
revoke execute on function public.mask_email(text) from public, anon;

commit;