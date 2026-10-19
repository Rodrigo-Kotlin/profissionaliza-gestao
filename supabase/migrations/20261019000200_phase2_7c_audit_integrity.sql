-- -----------------------------------------------------------------------------
-- Phase 2.7C.2: keep client session audit events narrowly scoped
-- -----------------------------------------------------------------------------
-- Domain audit events continue to call write_audit_log from controlled
-- SECURITY DEFINER functions and triggers. It must not be an API RPC.
revoke execute on function public.write_audit_log(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.log_session_event(p_event_type text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  audit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_event_type is null or p_event_type not in ('auth.login', 'auth.logout') then
    raise exception 'Invalid session event type' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_event_type, 'session', null, '{}'::jsonb)
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke execute on function public.log_session_event(text) from public, anon;
grant execute on function public.log_session_event(text) to authenticated;
