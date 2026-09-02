begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) between 1 and 160),
  constraint profiles_email_length check (char_length(email) between 3 and 320),
  constraint profiles_avatar_url_length check (char_length(avatar_url) <= 2048),
  constraint profiles_phone_length check (char_length(phone) <= 32)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_code_format check (code ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  constraint roles_name_length check (char_length(name) between 1 and 120)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  module text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_code_format check (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint permissions_description_length check (char_length(description) between 1 and 240)
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_length check (char_length(action) between 1 and 100),
  constraint audit_logs_entity_type_length check (char_length(entity_type) between 1 and 80),
  constraint audit_logs_entity_id_length check (char_length(entity_id) <= 200),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint audit_logs_metadata_size check (pg_column_size(metadata) <= 8192)
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint system_settings_key_format check (key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  constraint system_settings_description_length check (char_length(description) <= 240),
  constraint system_settings_value_size check (pg_column_size(value) <= 65536)
);

create index if not exists role_permissions_permission_id_idx
  on public.role_permissions(permission_id, role_id);
create index if not exists user_roles_role_id_idx
  on public.user_roles(role_id, user_id);
create index if not exists audit_logs_actor_created_at_idx
  on public.audit_logs(actor_id, created_at desc);
create index if not exists audit_logs_entity_created_at_idx
  on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);
create index if not exists profiles_active_name_idx
  on public.profiles(is_active, full_name);
create unique index if not exists profiles_email_lower_idx
  on public.profiles(lower(email));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.has_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = upper(requested_role)
  );
$$;

create or replace function public.has_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.code = lower(requested_permission)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select public.has_role('ADMIN');
$$;

create or replace function public.get_my_permissions()
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select coalesce(array_agg(distinct p.code order by p.code), array[]::text[])
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  audit_id uuid;
  safe_metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_action is null or char_length(p_action) not between 1 and 100
     or p_action !~ '^[a-z0-9_.:-]+$' then
    raise exception 'Invalid audit action' using errcode = '22023';
  end if;

  if p_entity_type is null or char_length(p_entity_type) not between 1 and 80
     or p_entity_type !~ '^[a-z0-9_.:-]+$' then
    raise exception 'Invalid audit entity type' using errcode = '22023';
  end if;

  if p_entity_id is not null and char_length(p_entity_id) > 200 then
    raise exception 'Invalid audit entity id' using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Audit metadata must be a JSON object' using errcode = '22023';
  end if;

  safe_metadata := p_metadata - array[
    'email', 'phone', 'display_name', 'full_name', 'cpf', 'document',
    'password', 'token', 'access_token', 'refresh_token'
  ];

  if pg_column_size(safe_metadata) > 4096 then
    raise exception 'Audit metadata is too large' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, safe_metadata)
  returning id into audit_id;

  return audit_id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Usuário'), 160),
    left(coalesce(new.email, new.id::text || '@pending.local'), 320),
    left(new.raw_user_meta_data ->> 'avatar_url', 2048)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();

    if auth.uid() = new.id and not public.has_permission('users.manage') then
      new.is_active := true;
    end if;
  elsif new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity fields cannot be changed' using errcode = '42501';
  elsif auth.uid() = old.id
     and not public.has_permission('users.manage')
     and (new.is_active is distinct from old.is_active or new.email is distinct from old.email) then
    raise exception 'Protected profile fields cannot be changed' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  row_data jsonb;
  old_data jsonb;
  changed_fields jsonb := '[]'::jsonb;
  object_id text;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    old_data := to_jsonb(old);
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
      into changed_fields
    from (
      select key as k
      from jsonb_object_keys(row_data) as key
      where key <> 'updated_at'
        and row_data -> key is distinct from old_data -> key
    ) changed;
  end if;

  object_id := case
    when tg_table_name = 'user_roles' then
      concat_ws(':', row_data ->> 'user_id', row_data ->> 'role_id')
    when tg_table_name = 'role_permissions' then
      concat_ws(':', row_data ->> 'role_id', row_data ->> 'permission_id')
    else coalesce(row_data ->> 'id', row_data ->> 'key')
  end;

  audit_action := case
    when tg_table_name = 'profiles' then 'profile.' || lower(tg_op)
    when tg_table_name = 'system_settings' then 'settings.' || lower(tg_op)
    else 'rbac.' || tg_table_name || '.' || lower(tg_op)
  end;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    audit_action,
    tg_table_name,
    nullif(object_id, ''),
    case when tg_op = 'UPDATE'
      then jsonb_build_object('changed_fields', changed_fields)
      else '{}'::jsonb
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_10_protect_fields on public.profiles;
create trigger profiles_10_protect_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();

drop trigger if exists profiles_20_set_updated_at on public.profiles;
create trigger profiles_20_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();
drop trigger if exists permissions_set_updated_at on public.permissions;
create trigger permissions_set_updated_at before update on public.permissions
  for each row execute function public.set_updated_at();
drop trigger if exists role_permissions_set_updated_at on public.role_permissions;
create trigger role_permissions_set_updated_at before update on public.role_permissions
  for each row execute function public.set_updated_at();
drop trigger if exists user_roles_set_updated_at on public.user_roles;
create trigger user_roles_set_updated_at before update on public.user_roles
  for each row execute function public.set_updated_at();
drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_audit_changes on public.profiles;
create trigger profiles_audit_changes after insert or update or delete on public.profiles
  for each row execute function public.audit_table_change();
drop trigger if exists roles_audit_changes on public.roles;
create trigger roles_audit_changes after insert or update or delete on public.roles
  for each row execute function public.audit_table_change();
drop trigger if exists permissions_audit_changes on public.permissions;
create trigger permissions_audit_changes after insert or update or delete on public.permissions
  for each row execute function public.audit_table_change();
drop trigger if exists role_permissions_audit_changes on public.role_permissions;
create trigger role_permissions_audit_changes after insert or update or delete on public.role_permissions
  for each row execute function public.audit_table_change();
drop trigger if exists user_roles_audit_changes on public.user_roles;
create trigger user_roles_audit_changes after insert or update or delete on public.user_roles
  for each row execute function public.audit_table_change();
drop trigger if exists system_settings_audit_changes on public.system_settings;
create trigger system_settings_audit_changes after insert or update or delete on public.system_settings
  for each row execute function public.audit_table_change();

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;

drop policy if exists profiles_select_own_or_directory on public.profiles;
create policy profiles_select_own_or_directory on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.has_permission('users.view')
    or public.has_permission('users.manage')
  );

drop policy if exists profiles_insert_own_or_manage on public.profiles;
create policy profiles_insert_own_or_manage on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.has_permission('users.manage'));

drop policy if exists profiles_update_own_or_manage on public.profiles;
create policy profiles_update_own_or_manage on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_permission('users.manage'))
  with check (id = auth.uid() or public.has_permission('users.manage'));

drop policy if exists roles_select_authorized on public.roles;
create policy roles_select_authorized on public.roles
  for select to authenticated
  using (public.has_permission('rbac.view') or public.has_permission('users.manage'));
drop policy if exists roles_manage on public.roles;
create policy roles_manage on public.roles
  for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists permissions_select_authorized on public.permissions;
create policy permissions_select_authorized on public.permissions
  for select to authenticated
  using (public.has_permission('rbac.view') or public.has_permission('users.manage'));
drop policy if exists permissions_manage on public.permissions;
create policy permissions_manage on public.permissions
  for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists role_permissions_select_authorized on public.role_permissions;
create policy role_permissions_select_authorized on public.role_permissions
  for select to authenticated
  using (public.has_permission('rbac.view') or public.has_permission('users.manage'));
drop policy if exists role_permissions_manage on public.role_permissions;
create policy role_permissions_manage on public.role_permissions
  for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists user_roles_select_authorized on public.user_roles;
create policy user_roles_select_authorized on public.user_roles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission('rbac.view')
    or public.has_permission('users.manage')
  );
drop policy if exists user_roles_manage on public.user_roles;
create policy user_roles_manage on public.user_roles
  for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists audit_logs_select_authorized on public.audit_logs;
create policy audit_logs_select_authorized on public.audit_logs
  for select to authenticated
  using (public.is_admin() or public.has_permission('audit.view'));

drop policy if exists system_settings_select_authorized on public.system_settings;
create policy system_settings_select_authorized on public.system_settings
  for select to authenticated
  using (
    is_public
    or public.has_permission('settings.view')
    or public.has_permission('settings.manage')
  );
drop policy if exists system_settings_manage on public.system_settings;
create policy system_settings_manage on public.system_settings
  for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.roles from public, anon, authenticated;
revoke all on table public.permissions from public, anon, authenticated;
revoke all on table public.role_permissions from public, anon, authenticated;
revoke all on table public.user_roles from public, anon, authenticated;
revoke all on table public.audit_logs from public, anon, authenticated;
revoke all on table public.system_settings from public, anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.roles to authenticated;
grant select, insert, update, delete on table public.permissions to authenticated;
grant select, insert, update, delete on table public.role_permissions to authenticated;
grant select, insert, update, delete on table public.user_roles to authenticated;
grant select on table public.audit_logs to authenticated;
grant select, insert, update, delete on table public.system_settings to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.has_role(text) from public, anon, authenticated;
revoke all on function public.has_permission(text) from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.get_my_permissions() from public, anon, authenticated;
revoke all on function public.write_audit_log(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_fields() from public, anon, authenticated;
revoke all on function public.audit_table_change() from public, anon, authenticated;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_my_permissions() to authenticated;
grant execute on function public.write_audit_log(text, text, text, jsonb) to authenticated;

commit;
