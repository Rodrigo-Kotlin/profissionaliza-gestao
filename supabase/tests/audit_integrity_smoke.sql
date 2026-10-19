-- FASE 2.7C.2 — audit integrity smoke test.
-- Local-only/prepared smoke. Run inside a disposable local database, never
-- against Production. The transaction rolls back all session audit rows.
begin;

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at limit 1;
  if v_user_id is null then
    raise exception 'A local auth user is required for the authenticated smoke test';
  end if;
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
end;
$$;

set local role authenticated;

select public.log_session_event('auth.login');
select public.log_session_event('auth.logout');

do $$
begin
  begin
    perform public.log_session_event('auth.admin');
    raise exception 'arbitrary session event was accepted';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.write_audit_log('forged.admin', 'admin', 'forged', '{}'::jsonb);
    raise exception 'authenticated write_audit_log execution was not revoked';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

set local role anon;

do $$
begin
  begin
    perform public.log_session_event('auth.login');
    raise exception 'anon session audit execution was not revoked';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

rollback;
