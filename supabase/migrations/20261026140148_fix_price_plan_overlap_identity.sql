-- FASE 2.8A.5.1 — correção da identidade de equivalência de price plans.
--
-- LOCK_IDENTITY = CONFLICT_IDENTITY:
-- offer_id, payment_method, pricing_model, quantity_min, quantity_max,
-- installment_count.
--
-- Valores monetários não fazem parte da identidade: uma mesma condição
-- comercial com valores divergentes continua sendo conflito.

create or replace function public.prevent_active_price_plan_overlap()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status = 'ACTIVE' then
    perform pg_advisory_xact_lock(hashtextextended(
      concat_ws(':', new.offer_id::text, new.payment_method, new.pricing_model,
        coalesce(new.quantity_min::text, '*'), coalesce(new.quantity_max::text, '*'),
        coalesce(new.installment_count::text, '*')), 0));
    if exists (
      select 1
      from public.price_plans existing
      where existing.id <> new.id
        and existing.status = 'ACTIVE'
        and existing.offer_id = new.offer_id
        and existing.payment_method = new.payment_method
        and existing.pricing_model = new.pricing_model
        and existing.quantity_min is not distinct from new.quantity_min
        and existing.quantity_max is not distinct from new.quantity_max
        and existing.installment_count is not distinct from new.installment_count
        and tstzrange(existing.valid_from, coalesce(existing.valid_until, 'infinity'::timestamptz), '[)')
          && tstzrange(new.valid_from, coalesce(new.valid_until, 'infinity'::timestamptz), '[)')
    ) then
      raise exception 'An equivalent active price plan already overlaps this validity period'
        using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;
