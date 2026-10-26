-- FASE 2.8A.5.1 — smoke read-only da identidade de overlap.
-- Não insere, atualiza, ativa ou desativa dados.
--
-- Matriz conceitual coberta pela identidade:
-- A CARD 1x + CARD 2x                         -> permitido
-- B CARD 3x + CARD 5x                         -> permitido
-- C CARD 3x + outro CARD 3x sobreposto        -> rejeitado (23P01)
-- D CARD 3x com vigência não sobreposta        -> permitido
-- E BOLETO 6x + BOLETO 12x                    -> permitido
-- F BOLETO 12x duplicado sobreposto            -> rejeitado (23P01)
-- G CASH + CASH equivalente sobreposto         -> rejeitado (23P01)
-- H ONLINE q1 CARD 3x + q1 CARD 5x             -> permitido
-- I ONLINE q1 CARD 3x duplicado                -> rejeitado (23P01)
-- J ONLINE q1 CARD 3x + q2 CARD 3x             -> permitido

do $$
declare
  v_definition text;
  v_trigger_count bigint;
begin
  select pg_get_functiondef('public.prevent_active_price_plan_overlap()'::regprocedure)
    into v_definition;

  if v_definition is null then
    raise exception 'prevent_active_price_plan_overlap is missing';
  end if;

  -- The advisory lock and conflict predicate must share installment_count.
  if v_definition not like '%coalesce(new.installment_count::text, ''*'')%' then
    raise exception 'installment_count is missing from overlap advisory lock identity';
  end if;
  if v_definition not like '%existing.installment_count is not distinct from new.installment_count%' then
    raise exception 'installment_count is missing from overlap conflict identity';
  end if;

  -- Monetary fields must not become part of the identity.
  if v_definition like '%existing.installment_amount%' or v_definition like '%existing.total_amount%' or v_definition like '%existing.cash_price%' or v_definition like '%existing.enrollment_fee%' then
    raise exception 'Monetary fields must not define overlap identity';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'price_plans'
    and t.tgname = 'price_plans_prevent_active_overlap'
    and not t.tgisinternal;
  if v_trigger_count <> 1 then
    raise exception 'Expected exactly one price plan overlap trigger';
  end if;
end;
$$;
