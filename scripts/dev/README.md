# Scripts DEV — Massa E2E (Supabase DEV)

Ambiente: único projeto da org `lkkdfzezwsbeuxllclct` = **DEV**
(`epjshcgsjvrydwuyqixi`). Sem Docker; acesso SQL via
`supabase db query --linked`.

> **Importante (2026-09-13):** o drift da migration `20260912100000` e o bug de
> CEP com zero à esquerda foram reconciliados/corrigidos oficialmente pela
> migration `20260913100000_phase2_4_identity_cep_corrections.sql`
> (`npx supabase db push` + `migration list` → `local = remote`). Por isso o
> antigo `sync-pr14-identity-functions.sql` está **DEPRECATED** — não execute.

## Ordem de execução (sempre nesta ordem)

```powershell
# 1) Reset controlado: limpa dados transacionais (contracts, sales, atividades,
#    stage history, leads, guardians, status history, students, people) + auditoria
#    transacional. PRESERVA courses, stages, sources, lost_reasons, roles,
#    permissions, profiles, system_settings e sequences (numeração continua).
#    Guard clause exige app.e2e_confirm = 'E2E-RESET-2026'.
supabase db query --linked -f scripts/dev/reset-e2e-data.sql

# 2) Seed: 5 clientes fictícios LEAD -> VENDA -> CONTRATO -> ALUNO via RPCs reais,
#    + 3 cenários de identidade (cpf_exact, LEAD_NAME_MISMATCH -> cpf_exact_forced,
#    POSSIBLE_DUPLICATE:phone -> contact_conflict_forced).
supabase db query --linked -f scripts/dev/seed-e2e-sales-contracts.sql
```

## Revalidação pós-correção (CEP via RPCs, sem UPDATE direto)

```powershell
# Roda 1 cliente completo (LEAD -> VENDA -> CONTRATO -> ALUNO) TUDO via RPCs,
# incluindo CEP '01001-000' por create_person e update_student, e valida
# people.postal_code + contractor_address_snapshot. Transação com ROLLBACK:
# nada persiste, reexecutável a qualquer momento.
supabase db query --linked -f scripts/dev/revalidate-cep-rpc-e2e.sql
```

## Smoke tests (transação, ROLLBACK, nada persiste)

```powershell
# Identidade v2 (create_crm_lead): 11 cenários.
supabase db query --linked -f supabase/tests/create_crm_lead_identity_smoke.sql

# CEP (zeros à esquerda) nas 4 portas de entrada: 8 cenários.
supabase db query --linked -f supabase/tests/postal_code_smoke.sql
```

## Deprecated

- `sync-pr14-identity-functions.sql` — **NÃO EXECUTAR** (ver nota acima). Ficou
  como registro histórico do catch-up temporário da fase E2E.

## Identidade de execução

Os RPCs exigem `auth.uid()` + permissões. Os scripts executam como usuário de
reserva ADMIN (perfil único do DEV) via `request.jwt.claims` — mesmo mecanismo
dos smoke tests da fase 2.4.

## Guardas

- `reset-e2e-data.sql`: falha sem o marcador `app.e2e_confirm = E2E-RESET-2026`.
- `seed-e2e-sales-contracts.sql`: falha se já existir lead/pessoa com marcador
  `E2E QA RESET 2026-09` (rode o reset antes de re-seedar).
- `revalidate-cep-rpc-e2e.sql`: roda em transação com ROLLBACK final; nada
  persiste no DEV (sequences podem avançar — comportamento esperado).
- Todos rodam dentro de transação quando aplicável; sem TRUNCATE CASCADE.