-- ============================================================================
-- FASE 2.4 — CONTRACTS RPCS
-- 9 RPCs Contracts + extensão de get_sale_detail (Contract associado).
--
-- Regras transversais:
--   - SECURITY DEFINER + search_path fixo + row_security off (padrão projeto).
--   - Permission e ownership sempre revalidadas server-side.
--   - Snapshots comerciais/acadêmicos imutáveis desde a criação.
--   - Snapshots do contratante recarregados de public.people (refresh em DRAFT).
--   - PII: mascaramento aplicado no PostgreSQL conforme contracts.view_sensitive.
--   - Auditoria exclusivamente server-side, sem PII no metadata.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. RPC — create_contract_from_sale
-- ---------------------------------------------------------------------------
create or replace function public.create_contract_from_sale(
  p_sale_id              uuid,
  p_contractor_person_id uuid,
  p_contract_notes       text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_sale            record;
  v_student         record;
  v_student_person  record;
  v_contractor      record;
  v_course          record;
  v_contract_id     uuid;
  v_contract_code   text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.create') then
    raise exception 'Permission denied: contracts.create' using errcode = '42501';
  end if;

  -- 1. SELECT Sale FOR UPDATE (tudo em uma transação)
  select * into v_sale from public.sales where id = p_sale_id for update;

  if v_sale is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if v_sale.status <> 'CONFIRMED' then
    raise exception 'Only confirmed sales can generate a contract' using errcode = '22023';
  end if;

  -- 2. Autorização: seller próprio OU papel global de mutation (todos com view_all)
  if v_sale.seller_user_id <> auth.uid() and not public.has_permission('contracts.view_all') then
    raise exception 'Permission denied: not sale seller' using errcode = '42501';
  end if;

  -- 3. one Sale -> max one Contract (sale_id UNIQUE também protege concorrência)
  if exists (select 1 from public.contracts where sale_id = p_sale_id) then
    raise exception 'Contract already exists for this sale' using errcode = '22023';
  end if;

  -- 4. Student + person (snapshot de nome)
  select * into v_student from public.students where id = v_sale.student_id;
  if v_student is null then
    raise exception 'Student not found' using errcode = 'P0002';
  end if;

  select * into v_student_person from public.people where id = v_student.person_id;
  if v_student_person is null then
    raise exception 'Student person not found' using errcode = 'P0002';
  end if;

  -- 5. Contractor deve existir
  select * into v_contractor from public.people where id = p_contractor_person_id;
  if v_contractor is null then
    raise exception 'Contractor not found' using errcode = 'P0002';
  end if;

  -- 6. Course da Sale
  select * into v_course from public.courses where id = v_sale.course_id;
  if v_course is null then
    raise exception 'Course not found' using errcode = 'P0002';
  end if;

  -- 7. Código concorrente-seguro: CTR-YYYY-NNNNNN
  v_contract_code := 'CTR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.contract_code_seq')::text, 6, '0');

  -- 8. INSERT DRAFT com todos os snapshots
  insert into public.contracts (
    contract_code, sale_id, student_id, contractor_person_id, status,
    student_name_snapshot,
    contractor_name_snapshot, contractor_cpf_snapshot,
    contractor_address_snapshot, contractor_phone_snapshot, contractor_email_snapshot,
    course_name_snapshot, course_workload_snapshot, course_modality_snapshot,
    gross_value_snapshot, discount_value_snapshot, net_value_snapshot,
    payment_method_snapshot, installments_snapshot, commercial_notes_snapshot,
    contract_notes, created_by, updated_by
  ) values (
    v_contract_code, p_sale_id, v_sale.student_id, p_contractor_person_id, 'DRAFT',
    v_student_person.full_name,
    v_contractor.full_name, v_contractor.cpf,
    case
      when v_contractor.street is null and v_contractor.postal_code is null and v_contractor.city is null then null
      else jsonb_build_object(
        'postal_code', v_contractor.postal_code, 'street', v_contractor.street,
        'number', v_contractor.number, 'complement', v_contractor.complement,
        'district', v_contractor.district, 'city', v_contractor.city,
        'state', v_contractor.state, 'country', v_contractor.country
      )
    end,
    v_contractor.phone, v_contractor.email,
    v_sale.course_name_snapshot, v_course.workload_hours, v_course.modality,
    v_sale.gross_value, v_sale.discount_value,
    (v_sale.gross_value - v_sale.discount_value),
    v_sale.payment_method, v_sale.installments, v_sale.commercial_notes,
    nullif(trim(coalesce(p_contract_notes, '')), ''),
    auth.uid(), auth.uid()
  )
  returning id into v_contract_id;

  -- 9. Auditoria server-side (metadata sem PII)
  perform public.write_audit_log(
    'contracts.created', 'contract', v_contract_id::text,
    jsonb_build_object(
      'contract_code', v_contract_code,
      'sale_id', p_sale_id::text,
      'sale_code', v_sale.sale_code,
      'student_id', v_sale.student_id::text,
      'contractor_person_id', p_contractor_person_id::text,
      'course_id', v_sale.course_id::text,
      'net_value_snapshot', (v_sale.gross_value - v_sale.discount_value),
      'status', 'DRAFT'
    )
  );

  return json_build_object(
    'contract_id', v_contract_id,
    'contract_code', v_contract_code,
    'status', 'DRAFT'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. RPC — update_contract_draft
-- ---------------------------------------------------------------------------
create or replace function public.update_contract_draft(
  p_contract_id          uuid,
  p_contractor_person_id uuid,
  p_contract_notes       text
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract      record;
  v_contractor    record;
  v_seller_id     uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.edit_draft') then
    raise exception 'Permission denied: contracts.edit_draft' using errcode = '42501';
  end if;

  select * into v_contract from public.contracts where id = p_contract_id for update;

  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if v_contract.status <> 'DRAFT' then
    raise exception 'Only draft contracts can be edited' using errcode = '22023';
  end if;

  -- Ownership: seller own OU global mutation role (view_all)
  select s.seller_user_id into v_seller_id from public.sales s where s.id = v_contract.sale_id;
  if v_seller_id <> auth.uid() and not public.has_permission('contracts.view_all') then
    raise exception 'Permission denied: not contract owner' using errcode = '42501';
  end if;

  select * into v_contractor from public.people where id = p_contractor_person_id;
  if v_contractor is null then
    raise exception 'Contractor not found' using errcode = 'P0002';
  end if;

  -- Refresh dos snapshots do contratante é SEMPRE executado em DRAFT,
  -- assim correções feitas em public.people são incorporadas.
  update public.contracts set
    contractor_person_id = p_contractor_person_id,
    contractor_name_snapshot = v_contractor.full_name,
    contractor_cpf_snapshot = v_contractor.cpf,
    contractor_address_snapshot = case
      when v_contractor.street is null and v_contractor.postal_code is null and v_contractor.city is null then null
      else jsonb_build_object(
        'postal_code', v_contractor.postal_code, 'street', v_contractor.street,
        'number', v_contractor.number, 'complement', v_contractor.complement,
        'district', v_contractor.district, 'city', v_contractor.city,
        'state', v_contractor.state, 'country', v_contractor.country
      )
    end,
    contractor_phone_snapshot = v_contractor.phone,
    contractor_email_snapshot = v_contractor.email,
    contract_notes = nullif(trim(coalesce(p_contract_notes, '')), ''),
    updated_by = auth.uid()
  where id = p_contract_id;

  perform public.write_audit_log(
    'contracts.updated_draft', 'contract', p_contract_id::text,
    jsonb_build_object(
      'contract_code', v_contract.contract_code,
      'sale_id', v_contract.sale_id::text,
      'contractor_changed', (v_contract.contractor_person_id is distinct from p_contractor_person_id)
    )
  );

  return json_build_object('contract_id', p_contract_id, 'contract_code', v_contract.contract_code, 'status', 'DRAFT');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC — issue_contract (DRAFT -> PENDING_SIGNATURE)
-- ---------------------------------------------------------------------------
create or replace function public.issue_contract(
  p_contract_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.issue') then
    raise exception 'Permission denied: contracts.issue' using errcode = '42501';
  end if;

  select * into v_contract from public.contracts where id = p_contract_id for update;

  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if v_contract.status <> 'DRAFT' then
    raise exception 'Only draft contracts can be issued' using errcode = '22023';
  end if;

  -- Após o issue nada mais pode ser alterado (valores, snapshots, contratante, notas).
  update public.contracts set
    status = 'PENDING_SIGNATURE',
    issued_at = now(),
    updated_by = auth.uid()
  where id = p_contract_id;

  perform public.write_audit_log(
    'contracts.issued', 'contract', p_contract_id::text,
    jsonb_build_object('contract_code', v_contract.contract_code, 'sale_id', v_contract.sale_id::text)
  );

  return json_build_object('contract_id', p_contract_id, 'contract_code', v_contract.contract_code, 'status', 'PENDING_SIGNATURE');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC — mark_contract_signed (PENDING_SIGNATURE -> SIGNED)
-- ---------------------------------------------------------------------------
create or replace function public.mark_contract_signed(
  p_contract_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.mark_signed') then
    raise exception 'Permission denied: contracts.mark_signed' using errcode = '42501';
  end if;

  select * into v_contract from public.contracts where id = p_contract_id for update;

  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if v_contract.status <> 'PENDING_SIGNATURE' then
    raise exception 'Only pending signature contracts can be marked as signed' using errcode = '22023';
  end if;

  update public.contracts set
    status = 'SIGNED',
    signed_at = now(),
    signature_confirmed_by = auth.uid(),
    updated_by = auth.uid()
  where id = p_contract_id;

  perform public.write_audit_log(
    'contracts.signed', 'contract', p_contract_id::text,
    jsonb_build_object('contract_code', v_contract.contract_code, 'sale_id', v_contract.sale_id::text)
  );

  return json_build_object('contract_id', p_contract_id, 'contract_code', v_contract.contract_code, 'status', 'SIGNED');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC — cancel_contract (DRAFT | PENDING_SIGNATURE -> CANCELED)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_contract(
  p_contract_id uuid,
  p_reason      text
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_contract record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.cancel') then
    raise exception 'Permission denied: contracts.cancel' using errcode = '42501';
  end if;

  select * into v_contract from public.contracts where id = p_contract_id for update;

  if v_contract is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if v_contract.status not in ('DRAFT', 'PENDING_SIGNATURE') then
    raise exception 'Only draft or pending signature contracts can be canceled' using errcode = '22023';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'Cancellation reason is required' using errcode = '22023';
  end if;

  if char_length(trim(p_reason)) > 2000 then
    raise exception 'Cancellation reason must be at most 2000 characters' using errcode = '22023';
  end if;

  update public.contracts set
    status = 'CANCELED',
    canceled_at = now(),
    canceled_by = auth.uid(),
    cancellation_reason = trim(p_reason),
    updated_by = auth.uid()
  where id = p_contract_id;

  -- Sale/Student/Lead permanecem intactos.

  perform public.write_audit_log(
    'contracts.canceled', 'contract', p_contract_id::text,
    jsonb_build_object(
      'contract_code', v_contract.contract_code,
      'sale_id', v_contract.sale_id::text,
      'cancellation_reason', trim(p_reason)
    )
  );

  return json_build_object('contract_id', p_contract_id, 'contract_code', v_contract.contract_code, 'status', 'CANCELED');
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RPC — list_contracts
--    Filtro de período: definido sobre created_at (padrão documentado).
-- ---------------------------------------------------------------------------
create or replace function public.list_contracts(
  p_search         text default null,
  p_status         text default null,
  p_seller_user_id uuid default null,
  p_course_id      uuid default null,
  p_date_from      date default null,
  p_date_to        date default null,
  p_page           integer default 1,
  p_page_size      integer default 20
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_total bigint;
  v_data json;
  v_seller_filter uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.view') then
    raise exception 'Permission denied: contracts.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('contracts.view_all');
  v_page := greatest(coalesce(p_page, 1), 1);
  v_page_size := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_offset := (v_page - 1) * v_page_size;

  -- Own-only: filtra sempre pelo próprio vendedor, ignorando seller de terceiros.
  v_seller_filter := p_seller_user_id;
  if not v_has_view_all then
    v_seller_filter := auth.uid();
  end if;

  -- Count
  select count(*) into v_total
  from public.contracts c
  join public.sales s on s.id = c.sale_id
  where
    (v_has_view_all or s.seller_user_id = auth.uid())
    and (p_status is null or c.status = p_status)
    and (v_seller_filter is null or s.seller_user_id = v_seller_filter)
    and (p_course_id is null or s.course_id = p_course_id)
    and (p_date_from is null or c.created_at >= p_date_from)
    and (p_date_to is null or c.created_at <= (p_date_to + interval '1 day' - interval '1 second'))
    and (p_search is null or p_search = '' or
         c.contract_code ilike '%' || p_search || '%' or
         c.student_name_snapshot ilike '%' || p_search || '%' or
         c.contractor_name_snapshot ilike '%' || p_search || '%');

  -- Data (sem PII sensível: sem CPF, sem endereço)
  select json_agg(row_to_json(t)) into v_data
  from (
    select
      c.id as contract_id,
      c.contract_code,
      c.status,
      c.student_id,
      st.student_code,
      c.student_name_snapshot as student_name,
      c.contractor_name_snapshot as contractor_name,
      c.course_name_snapshot as course_name,
      s.seller_user_id,
      sp.full_name as seller_name,
      c.net_value_snapshot,
      c.created_at,
      c.issued_at,
      c.signed_at
    from public.contracts c
    join public.sales s on s.id = c.sale_id
    join public.students st on st.id = c.student_id
    join public.profiles sp on sp.id = s.seller_user_id
    where
      (v_has_view_all or s.seller_user_id = auth.uid())
      and (p_status is null or c.status = p_status)
      and (v_seller_filter is null or s.seller_user_id = v_seller_filter)
      and (p_course_id is null or s.course_id = p_course_id)
      and (p_date_from is null or c.created_at >= p_date_from)
      and (p_date_to is null or c.created_at <= (p_date_to + interval '1 day' - interval '1 second'))
      and (p_search is null or p_search = '' or
           c.contract_code ilike '%' || p_search || '%' or
           c.student_name_snapshot ilike '%' || p_search || '%' or
           c.contractor_name_snapshot ilike '%' || p_search || '%')
    order by c.created_at desc
    limit v_page_size
    offset v_offset
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC — get_contract_detail
-- ---------------------------------------------------------------------------
create or replace function public.get_contract_detail(
  p_contract_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_sensitive boolean;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.view') then
    raise exception 'Permission denied: contracts.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('contracts.view_all');
  v_sensitive := public.has_permission('contracts.view_sensitive');

  select json_build_object(
    'contract_id', c.id,
    'contract_code', c.contract_code,
    'status', c.status,
    -- Origem
    'sale_id', c.sale_id,
    'sale_code', s.sale_code,
    'sale_status', s.status,
    'seller_user_id', s.seller_user_id,
    'seller_name', sp.full_name,
    'course_id', s.course_id,
    -- Student
    'student_id', c.student_id,
    'student_code', st.student_code,
    'student_name', c.student_name_snapshot,
    -- Contractor snapshot (PII mascarada sem view_sensitive, decidido no PostgreSQL)
    'contractor_person_id', c.contractor_person_id,
    'contractor_name', c.contractor_name_snapshot,
    'contractor_cpf', case when v_sensitive then c.contractor_cpf_snapshot else public.mask_cpf(c.contractor_cpf_snapshot) end,
    'contractor_phone', case when v_sensitive then c.contractor_phone_snapshot else public.mask_phone(c.contractor_phone_snapshot) end,
    'contractor_email', case when v_sensitive then c.contractor_email_snapshot else public.mask_email(c.contractor_email_snapshot) end,
    'contractor_address', case when v_sensitive then c.contractor_address_snapshot else null end,
    -- Curso (snapshot)
    'course_name_snapshot', c.course_name_snapshot,
    'course_workload_snapshot', c.course_workload_snapshot,
    'course_modality_snapshot', c.course_modality_snapshot,
    -- Condições comerciais (snapshot)
    'gross_value_snapshot', c.gross_value_snapshot,
    'discount_value_snapshot', c.discount_value_snapshot,
    'net_value_snapshot', c.net_value_snapshot,
    'payment_method_snapshot', c.payment_method_snapshot,
    'installments_snapshot', c.installments_snapshot,
    'commercial_notes_snapshot', c.commercial_notes_snapshot,
    -- Notas e datas
    'contract_notes', c.contract_notes,
    'created_at', c.created_at,
    'updated_at', c.updated_at,
    'issued_at', c.issued_at,
    'signed_at', c.signed_at,
    'signature_confirmed_by', c.signature_confirmed_by,
    'canceled_at', c.canceled_at,
    'canceled_by', c.canceled_by,
    'canceled_by_name', cbp.full_name,
    'cancellation_reason', c.cancellation_reason,
    'created_by', c.created_by,
    'created_by_name', cby.full_name,
    'sensitive', v_sensitive
  ) into v_result
  from public.contracts c
  join public.sales s on s.id = c.sale_id
  join public.students st on st.id = c.student_id
  join public.profiles sp on sp.id = s.seller_user_id
  left join public.profiles cbp on cbp.id = c.canceled_by
  left join public.profiles cby on cby.id = c.created_by
  where c.id = p_contract_id;

  if v_result is null then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  -- Ownership (após confirmar existência, para não vazar existence via erro)
  if not v_has_view_all then
    if not exists (
      select 1
      from public.contracts c
      join public.sales s on s.id = c.sale_id
      where c.id = p_contract_id and s.seller_user_id = auth.uid()
    ) then
      raise exception 'Not authorized to view this contract' using errcode = '42501';
    end if;
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RPC — get_contract_timeline (lê audit_logs, sem contract_status_history)
-- ---------------------------------------------------------------------------
create or replace function public.get_contract_timeline(
  p_contract_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_exists boolean;
  v_data json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.view') then
    raise exception 'Permission denied: contracts.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('contracts.view_all');

  select exists(select 1 from public.contracts where id = p_contract_id) into v_exists;
  if not v_exists then
    raise exception 'Contract not found' using errcode = 'P0002';
  end if;

  if not v_has_view_all then
    if not exists (
      select 1
      from public.contracts c
      join public.sales s on s.id = c.sale_id
      where c.id = p_contract_id and s.seller_user_id = auth.uid()
    ) then
      raise exception 'Not authorized to view this contract' using errcode = '42501';
    end if;
  end if;

  select json_agg(row_to_json(t)) into v_data
  from (
    select
      al.id,
      al.action as event_type,
      al.created_at as occurred_at,
      case al.action
        when 'contracts.created' then 'Contrato criado'
        when 'contracts.updated_draft' then 'Rascunho editado'
        when 'contracts.issued' then 'Contrato emitido'
        when 'contracts.signed' then 'Contrato assinado'
        when 'contracts.canceled' then 'Contrato cancelado'
        else al.action
      end as title,
      case
        when al.action = 'contracts.canceled' then al.metadata ->> 'cancellation_reason'
        when al.action = 'contracts.updated_draft' then 'Dados do contratante atualizados'
        else null
      end as description,
      al.actor_id as actor_user_id,
      pr.full_name as actor_name,
      al.metadata
    from public.audit_logs al
    left join public.profiles pr on pr.id = al.actor_id
    where al.entity_type = 'contract'
      and al.entity_id = p_contract_id::text
      and al.action in ('contracts.created','contracts.updated_draft','contracts.issued','contracts.signed','contracts.canceled')
    order by al.created_at asc
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'total', coalesce(json_array_length(v_data), 0)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. RPC — search_contractor_people (busca mascarada, sempre)
-- ---------------------------------------------------------------------------
create or replace function public.search_contractor_people(
  p_query  text default null,
  p_limit  integer default 20
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_query text;
  v_limit integer;
  v_total bigint;
  v_data json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('contracts.create') then
    raise exception 'Permission denied: contracts.create' using errcode = '42501';
  end if;

  v_query := trim(coalesce(p_query, ''));
  v_limit := least(greatest(coalesce(p_limit, 20), 1), 20);

  if char_length(v_query) < 2 then
    return json_build_object('data', '[]'::json, 'total', 0);
  end if;

  -- CPF: match exato (query de 11 dígitos). Nome: ILIKE.
  -- Retorno sempre mascarado (mesmo com view_sensitive) — nunca CPF completo aqui.
  select count(*) into v_total
  from public.people p
  where p.is_active = true
    and (
      (v_query ~ '^[0-9]{11}$' and p.cpf = v_query)
      or
      (not (v_query ~ '^[0-9]{11}$') and p.full_name ilike '%' || v_query || '%')
    );

  select coalesce(json_agg(json_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'preferred_name', p.preferred_name,
    'cpf_masked', public.mask_cpf(p.cpf),
    'phone_masked', public.mask_phone(p.phone),
    'email_masked', public.mask_email(p.email)
  ) order by lower(p.full_name)), '[]'::json)
    into v_data
  from public.people p
  where p.is_active = true
    and (
      (v_query ~ '^[0-9]{11}$' and p.cpf = v_query)
      or
      (not (v_query ~ '^[0-9]{11}$') and p.full_name ilike '%' || v_query || '%')
    )
  limit v_limit;

  return json_build_object('data', v_data, 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. SALES INTEGRATION — get_sale_detail com Contract associado
--     LEFT JOIN por sale_id sem filtro de status: CANCELED continua visível.
-- ---------------------------------------------------------------------------
create or replace function public.get_sale_detail(
  p_sale_id uuid
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
declare
  v_has_view_all boolean;
  v_result json;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.has_permission('sales.view') then
    raise exception 'Permission denied: sales.view' using errcode = '42501';
  end if;

  v_has_view_all := public.has_permission('sales.view_all');

  select json_build_object(
    'id', s.id,
    'sale_code', s.sale_code,
    'status', s.status,
    'lead_id', s.lead_id,
    'lead_code', l.lead_code,
    'person_id', s.person_id,
    'full_name', p.full_name,
    'student_id', s.student_id,
    'student_code', st.student_code,
    'course_id', s.course_id,
    'course_name_snapshot', s.course_name_snapshot,
    'course_price_snapshot', s.course_price_snapshot,
    'seller_user_id', s.seller_user_id,
    'seller_name', sp.full_name,
    'sale_date', to_char(s.sale_date, 'YYYY-MM-DD'),
    'gross_value', s.gross_value,
    'discount_value', s.discount_value,
    'net_value', s.net_value,
    'payment_method', s.payment_method,
    'installments', s.installments,
    'commercial_notes', s.commercial_notes,
    'canceled_at', s.canceled_at,
    'canceled_by', s.canceled_by,
    'canceled_by_name', cp.full_name,
    'cancellation_reason', s.cancellation_reason,
    'created_by', s.created_by,
    'created_by_name', crp.full_name,
    'created_at', s.created_at,
    'updated_at', s.updated_at,
    -- Contract associado (0..1), sem filtro de status
    'contract_id', ct.id,
    'contract_code', ct.contract_code,
    'contract_status', ct.status
  ) into v_result
  from public.sales s
  join public.people p on p.id = s.person_id
  join public.students st on st.id = s.student_id
  join public.profiles sp on sp.id = s.seller_user_id
  left join public.crm_leads l on l.id = s.lead_id
  left join public.profiles cp on cp.id = s.canceled_by
  left join public.profiles crp on crp.id = s.created_by
  left join public.contracts ct on ct.sale_id = s.id
  where s.id = p_sale_id;

  if v_result is null then
    raise exception 'Sale not found' using errcode = 'P0002';
  end if;

  if not v_has_view_all then
    if not exists (
      select 1 from public.sales where id = p_sale_id and seller_user_id = auth.uid()
    ) then
      raise exception 'Not authorized to view this sale' using errcode = '42501';
    end if;
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. GRANT/REVOKE — somente assinaturas exatas desta fase
-- ---------------------------------------------------------------------------
revoke execute on function public.create_contract_from_sale(uuid,uuid,text) from public, anon;
revoke execute on function public.update_contract_draft(uuid,uuid,text) from public, anon;
revoke execute on function public.issue_contract(uuid) from public, anon;
revoke execute on function public.mark_contract_signed(uuid) from public, anon;
revoke execute on function public.cancel_contract(uuid,text) from public, anon;
revoke execute on function public.list_contracts(text,text,uuid,uuid,date,date,integer,integer) from public, anon;
revoke execute on function public.get_contract_detail(uuid) from public, anon;
revoke execute on function public.get_contract_timeline(uuid) from public, anon;
revoke execute on function public.search_contractor_people(text,integer) from public, anon;
revoke execute on function public.get_sale_detail(uuid) from public, anon;

grant execute on function public.create_contract_from_sale(uuid,uuid,text) to authenticated;
grant execute on function public.update_contract_draft(uuid,uuid,text) to authenticated;
grant execute on function public.issue_contract(uuid) to authenticated;
grant execute on function public.mark_contract_signed(uuid) to authenticated;
grant execute on function public.cancel_contract(uuid,text) to authenticated;
grant execute on function public.list_contracts(text,text,uuid,uuid,date,date,integer,integer) to authenticated;
grant execute on function public.get_contract_detail(uuid) to authenticated;
grant execute on function public.get_contract_timeline(uuid) to authenticated;
grant execute on function public.search_contractor_people(text,integer) to authenticated;
grant execute on function public.get_sale_detail(uuid) to authenticated;

commit;