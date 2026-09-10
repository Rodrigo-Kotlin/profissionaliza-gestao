# Roadmap

## Fase 1 — Fundação
**Status: concluída**

Autenticação, RBAC, shell responsivo, dashboard executivo, administração inicial, auditoria e PWA.

## Fase 2.1 — Master Data: pessoas, alunos e responsáveis
**Status: concluída**

`people` como identidade central; `students` e `student_guardians` com RPCs de
domínio, RLS por permissão e masking LGPD no back end (ver `docs/DATABASE.md` e
`docs/RBAC.md`). Branch: `feature/master-data-people-students`.

## Fase 2.2 — CRM Comercial: Prospecção, Leads, Pipeline, Atividades
**Status: concluída**

Pipeline, leads, atividades, catálogo de cursos, ownership, RPCs controladas.
Migration aplicada no Supabase DEV; tipos regenerados.

## Fase 2.2.1 — Hardening
**Status: concluída (merged em `main` via PR #12, squash `da7a4da`)**

- Guards de rota reutilizáveis (`AuthRoute`/`PermissionRoute`) com 403 genérico.
- Consistência RBAC: matriz materializada por migration idempotente; seed sem RBAC.
- 14 novos testes Vitest (6 guards + 8 matriz) e cobertura v8 configurada.
- Playwright E2E opcional (`tests/e2e/`, 5 fluxos) — ver `docs/E2E.md`.
- `.nvmrc` e alinhamento de Node no `engines`.
- Migration `20260910120000_phase2_2_1_rbac_consistency.sql` aplicada no Supabase DEV (Local = Remote).

## Fase 2.3 — Sales
**Status: concluída (merged em `main` via PR #13, squash `0bcdfa1`)**

- Sales table com `course_name_snapshot`, `sale_code_seq`, RLS, CHECK ENUM `payment_method`
- Lead→Sale transacional atômica (FOR UPDATE, Student PRE_CADASTRO, ON CONFLICT DO NOTHING)
- RBAC: `sales.view`, `sales.view_all`, `sales.create`, `sales.approve`, `sales.cancel`
- Sales list com filtros (search, status, seller, course, period), paginação, page_size cap 100
- Sale detail com timeline (sales.created, sales.canceled), cancelamento com motivo
- CRM integration: Lead 360 mostra sale card, status WON da venda
- 4 migrations aplicadas no Supabase DEV (Local = Remote)
- 202 testes Vitest (16 arquivos), E2E smoke specs
- 2 correções de BLOCKER (ADMIN RBAC, VENDEDOR/RECEPCAO courses.view)

## Fase 2 — Cadastros mestres e núcleo acadêmico
**Status: em desenvolvimento

- Pessoas
- Alunos
- Cursos
- Matrizes
- Disciplinas
- Turmas
- Matrículas

Branch: `feature/master-data`

## Fase 3 — CRM e Comercial

CRM, leads, funil, vendas e atendimento.

## Fase 4 — Contratos e Financeiro

Contratos, comissões, contas a receber, cobranças e recebimentos.

## Fase 5 — Operação Pedagógica

Operação acadêmica: turmas, aulas, frequência e acompanhamento.

## Fase 6 — Dashboards, relatórios e automações

Indicadores, relatórios exportáveis e automações de processos.

---

### Versionamento sugerido

| Versão | Entrega |
| --- | --- |
| `v0.1.0` | Fundação |
| `v0.2.0` | Cadastros Mestres |
| `v0.3.0` | Comercial |
| `v0.4.0` | Financeiro |
| `v0.5.0` | Pedagógico |
| `v1.0.0` | MVP homologado |

Tags são criadas apenas quando associadas a uma entrega correspondente.
