# Scripts DEV — Massa E2E (Supabase DEV)

Ambiente: único projeto da org `lkkdfzezwsbeuxllclct` = **DEV**
(`epjshcgsjvrydwuyqixi`). Sem Docker; acesso SQL via
`supabase db query --linked`.

## Ordem de execução (sempre nesta ordem)

```powershell
# 1) Sincroniza create_crm_lead v2 + _crm_name_matches (PR #14, commit 8a9626a).
#    A migration 20260912100000 já está registrada no banco com conteúdo antigo
#    (b355657); este script aplica o conteúdo CORRIGIDO. Idempotente,
#    apenas objetos de função. Nenhuma migration nova.
supabase db query --linked -f scripts/dev/sync-pr14-identity-functions.sql

# 2) Reset controlado: limpa dados transacionais (contracts, sales, atividades,
#    stage history, leads, guardians, status history, students, people) + auditoria
#    transacional. PRESERVA courses, stages, sources, lost_reasons, roles,
#    permissions, profiles, system_settings e sequences (numeração continua).
#    Guard clause exige app.e2e_confirm = 'E2E-RESET-2026'.
supabase db query --linked -f scripts/dev/reset-e2e-data.sql

# 3) Seed: 5 clientes fictícios LEAD -> VENDA-> CONTRATO -> ALUNO via RPCs reais,
#    + 3 cenários de identidade (cpf_exact, LEAD_NAME_MISMATCH -> cpf_exact_forced,
#    POSSIBLE_DUPLICATE:phone -> contact_conflict_forced) + CEP 01001-000.
supabase db query --linked -f scripts/dev/seed-e2e-sales-contracts.sql
```

## Identidade de execução

Os RPCs exigem `auth.uid()` + permissões. O seed executa como usuário de reserva
ADMIN (perfil único do DEV) via `request.jwt.claims` — mesmo mecanismo do smoke
test da fase 2.4.

## Guardas

- `reset-e2e-data.sql`: falha sem o marcador `app.e2e_confirm = E2E-RESET-2026`.
- `seed-e2e-sales-contracts.sql`: falha se já existir lead/pessoa com marcador
  `E2E QA RESET 2026-09` (rode o reset antes de re-seedar).
- Ambos rodam dentro de transação quando aplicável; sem TRUNCATE CASCADE.