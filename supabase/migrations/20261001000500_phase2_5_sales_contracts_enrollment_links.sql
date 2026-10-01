-- FASE 2.5C — LINKS DE ENROLLMENT NOS DETALHES EXISTENTES
-- Wrappers preservam o payload atual e adicionam vínculo opcional da matrícula.

begin;

alter function public.get_sale_detail(uuid) rename to _get_sale_detail_base;
alter function public.get_contract_detail(uuid) rename to _get_contract_detail_base;

create or replace function public.get_sale_detail(p_sale_id uuid)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_result jsonb;
begin
  v_result := public._get_sale_detail_base(p_sale_id)::jsonb;
  return coalesce((select v_result || jsonb_build_object(
    'enrollment_id', e.id,
    'enrollment_code', e.enrollment_code,
    'enrollment_status', e.status
  )
  from public.enrollments e
  where e.sale_id = p_sale_id), v_result);
end; $$;

create or replace function public.get_contract_detail(p_contract_id uuid)
returns json language plpgsql security definer
set search_path = pg_catalog, public set row_security = off as $$
declare v_result jsonb;
begin
  v_result := public._get_contract_detail_base(p_contract_id)::jsonb;
  return coalesce((select v_result || jsonb_build_object(
    'enrollment_id', e.id,
    'enrollment_code', e.enrollment_code,
    'enrollment_status', e.status
  )
  from public.enrollments e
  where e.contract_id = p_contract_id), v_result);
end; $$;

revoke all on function public._get_sale_detail_base(uuid) from public, anon, authenticated;
revoke all on function public._get_contract_detail_base(uuid) from public, anon, authenticated;
revoke execute on function public.get_sale_detail(uuid) from public, anon;
revoke execute on function public.get_contract_detail(uuid) from public, anon;
grant execute on function public.get_sale_detail(uuid) to authenticated;
grant execute on function public.get_contract_detail(uuid) to authenticated;

commit;
