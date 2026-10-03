# Arquitetura

Este documento descreve a arquitetura técnica do **Profissionaliza Gestão**.

## Stack

- **Frontend**: React 19, TypeScript (strict), Vite 7.
- **Estilo**: Tailwind CSS com design system próprio (Manrope títulos, Inter interface, navy `#111744`, gold `#D9B64A`, canvas `#F8F9FF`).
- **Dados**: Supabase (Auth + PostgreSQL) com Row Level Security.
- **Cliente de dados**: @supabase/supabase-js, @tanstack/react-query.
- **Formulários**: React Hook Form + Zod (`@hookform/resolvers`).
- **UI**: Radix UI, Lucide Icons, Sonner, Recharts.
- **PWA**: Vite PWA (`vite-plugin-pwa`).

## Arquitetura frontend

Organização por **features** em `src/features/`, cada uma isolando página, provider e serviços do domínio:

```text
features/
  auth/        sessão, login e recuperação
  dashboard/   página, provider e dados demonstrativos
  search/      busca global e command palette
  users/       perfil e diretório
  students/    alunos, responsáveis e status
  crm/         pipeline, leads, atividades, cursos e catálogo
```

Camadas transversais em:

- `lib/` — Supabase client, RBAC e utilitários.
- `services/` — serviços transversais (ex.: auditoria).
- `types/` — contratos de domínio (Database).
- `routes/` — router e proteção de rotas.
- `layouts/` — app shell responsivo.
- `components/ui/` — primitives do design system.

O fluxo de dados segue **pages → services/querys → Supabase**, com componentes puros recebendo dados via props/contexto. Dados demonstrativos são isolados do JSX (ex.: `features/dashboard/dashboard-service.ts`), permitindo trocar por consultas reais sem reescrever a UI.

## Supabase

- **Auth**: Supabase Auth com persistência de sessão, auto-refresh e detecção de URL.
- **Client**: `src/lib/supabase.ts` lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do ambiente. Nunca hardcode credenciais.
- **Banco**: migrations versionadas em `supabase/migrations/`.

## Autenticação

- Login/recuperação/redefinição via Supabase Auth.
- Gerenciamento de RBAC via `user_roles`.
- Bootstrap da primeira conta ADMIN via contexto privilegiado no SQL Editor (funções `SECURITY DEFINER`).

## RLS

Toda tabela tem Row Level Security. Políticas baseadas nas funções `has_role`, `has_permission`, `is_admin` e `get_my_permissions`, definidas com `SECURITY DEFINER`, `search_path` fixo e grants mínimos.

A segurança é aplicada **no banco**, nunca apenas na UI. No front-end, `src/routes/permission-route.tsx` adiciona uma **segunda barreira** em nível de rota (`AuthRoute` + `PermissionRoute`), defensiva e transparente — ver `docs/RBAC.md`.

## Testes

- **Unitário/integração (Vitest)** em `src/**/*.test.{ts,tsx}`, ambiente `jsdom`, com
  cobertura v8 (`npm run test:coverage`) sem threshold obrigatório.
- **E2E (Playwright)** opcionais em `tests/e2e/` — rodam contra um target real
  (`E2E_BASE_URL`, ex.: preview do Cloudflare Pages) e exigem credenciais via
  ambiente. Sem env configurado, toda a suíte é **pulada** (ver `docs/E2E.md`).

## PWA

- Manifest e service worker gerados no build.
- Service worker armazena somente assets estáticos do app shell. Sem runtime cache de APIs, sessões ou dados pessoais.
- O PWA é app-shell offline, não offline-first: mutações são bloqueadas sem conexão.
- Não existe cache genérico de PII ou dados do Supabase.

## Navegação e contexto

- Listas usam `URLSearchParams` como fonte de verdade para busca, filtros, paginação e contexto de retorno relevante.
- Breadcrumbs e ações de retorno preservam o contexto da lista quando aplicável.

## Auditoria

Business-domain audit events are authoritative on the backend. RPCs
`SECURITY DEFINER` register these actions with the business operation, so
frontend audit logging must not duplicate RPC-side audit events after success.

The frontend audit service (`src/services/audit-service.ts`) remains available
for authentication events (`auth.login`/`auth.logout`) and client-only events
without an equivalent backend audit.

## Organização por features

- Cada domínio vive em `src/features/<dominio>/`.
- Nomeações consistentes: `<dominio>-page.tsx`, `<dominio>-service.ts`, etc.
- Dependência unidirecional: UI consome serviços, serviços consomem o client.

### Feature contracts (Fase 2.4)

Segue o mesmo padrão de `sales`: `contracts-types`, `contracts-constants`,
`contracts-schemas`, `contracts-utils` (helpers puros testáveis),
`contracts-service` (wrapper tipado do client), `contracts-hooks` (React Query) e
páginas/componentes (`contracts-list-page`, `contract-detail-page`,
`contract-create-wizard`, `contractor-search`, `create-person-modal`,
`edit/issue/sign/cancel-contract-dialog`).

Fluxo: a venda CONFIRMED no `sale-detail-page` abre o wizard; o serviço chama
RPCs `SECURITY DEFINER` (`create_contract_from_sale`, `issue_contract`, …) que
aplicam ownership, transições de estado e masking — o frontend nunca grava em
`public.contracts` diretamente.

### Feature enrollments (Fase 2.5)

`enrollments` representa a relação acadêmica do aluno com um curso; `students`
continua sendo o perfil global do aluno. A assinatura de um contrato chama a
mesma regra transacional que cria uma matrícula `PENDING`. A interface usa
`enrollments-service` e React Query para chamar exclusivamente as RPCs; não há
`select` direto da tabela nem auditoria duplicada no cliente.

O módulo expõe `/matriculas` e `/matriculas/:id`, com filtros em
`URLSearchParams`, leitura por `list_enrollments`/`get_enrollment_detail` e
ações independentes por status e permissão. Sale e Contract detail retornam o
vínculo opcional da matrícula, e Student Detail consulta as matrículas por
`student_id` pela mesma RPC.

**Homologação funcional validada (Fase 2.5D):**
- Contract SIGNED → Enrollment PENDING (idempotente)
- State machine: PENDING→ACTIVE→PAUSED→ACTIVE→COMPLETED; CANCELED terminais
- Multi-enrollment: Student ≠ Enrollment; um Student possui N Enrollments independentes
- Student status: PRE_CADASTRO→ATIVO na 1ª ativação; COMPLETED/CANCELED não rebaixam
- Seller scope: VENDEDOR vê apenas matrículas de suas Sales; sem ações acadêmicas
- Offline: `assertOnline` bloqueia; `offlineAwareMessage` exibe erro; backend inalterado
- Responsivo: 6 viewports (320–1366px) sem overflow
- Auditoria: 1 evento backend por ação (`enrollment.*`)
- Idempotência: 1 Contract → 1 Enrollment; 1 Sale → 1 Enrollment
- Cleanup determinístico por `RUN_ID` com 0 resíduos

## Fluxo de dependências

```text
routes (proteção)
   └─ features/<dominio> (páginas)
         └─ services/ + lib/ (dados, RBAC, supabase)
               └─ Supabase (RLS) → PostgreSQL
```

## Princípios arquiteturais

1. Segurança no banco (RLS) como primeira barreira.
2. Isolamento de domínios com identificadores e auditoria preservados entre eles.
3. Dados demonstrativos separados do JSX.
4. Sem credenciais ou segredos no código-fonte.
5. Comparência com LGPD: sem dados pessoais reais no repositório.
