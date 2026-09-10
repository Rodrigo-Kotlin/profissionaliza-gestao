-- Phase 2.3 Hotfix — Grant courses.view to VENDEDOR and RECEPCAO
--
-- BLOCKER: Both roles have sales.create (from 20260910160000_phase2_3_sales_rbac.sql)
-- but list_courses requires courses.view. Without it, the CloseSaleModal and
-- Sales list filters fail with 42501 when loading the course catalog.
--
-- This is a READ-ONLY grant. courses.manage (create/edit) remains gated.

begin;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('VENDEDOR',  'courses.view'),
  ('RECEPCAO',  'courses.view')
) as grants(role_code, permission_code)
join public.roles r on r.code = grants.role_code
join public.permissions p on p.code = grants.permission_code
on conflict do nothing;

commit;
