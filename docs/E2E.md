# Testes E2E (Playwright)

Os testes E2E validam fluxos reais contra uma instância **deployada** do app
(ex.: preview do Cloudflare Pages) ou uma instância local (`vite preview` do
build de produção). Requerem Supabase configurado com autenticação.

São **opcionais**: sem configuração de ambiente a suíte inteira é pulada, então
`npm run test:e2e` nunca falha por ausência de ambiente.

## Como executar

```sh
# 1) Instalar navegadores (uma vez por máquina)
npx playwright install chromium

# 2) Definir alvo + credenciais
# Alvo: preview do Cloudflare Pages (ou http://localhost:4173 com `npm run preview`)
export E2E_BASE_URL="https://<preview>.pages.dev"
# Conta com acesso amplo (CRM, pipeline, cursos, usuários, matrículas)
export E2E_EMAIL="admin@instituicao.com.br"
export E2E_PASSWORD="..."
# Conta restrita SEM courses.view (valida o 403 de rota)
export E2E_EMAIL_RESTRICTED="recepcao@instituicao.com.br"
export E2E_PASSWORD_RESTRICTED="..."
# Service Role para fixture/cleanup determinísticos (APENAS processo Node, NUNCA VITE_*)
export E2E_SERVICE_ROLE_KEY="..."

# 3) Rodar
npm run test:e2e
```

> Credenciais vão apenas como variáveis de ambiente — nunca no repositório.
> Os testes usam dados **reais** do ambiente (nunca dados pessoais reais em staging).
> **Service Role**: usada APENAS no processo Node de fixture/cleanup (`tests/e2e/enrollment-fixture.ts`), isolada via `tests/e2e/helpers.ts` com `dotenv/config`. Nunca em `VITE_*`, nunca no browser.

## Matriz de execução

| Fluxo | Arquivo | Requer | O que valida |
|---|---|---|---|
| E2E-01 Login | `login.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Login admin, dashboard e menu; credenciais inválidas não autenticam |
| E2E-02 RBAC | `rbac.spec.ts` | `E2E_EMAIL_RESTRICTED`/`E2E_PASSWORD_RESTRICTED` | Usuário sem `courses.view` recebe 403 genérico em `/crm/cursos`, sem vazar conteúdo/permissões |
| E2E-03 Kanban | `kanban.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Pipeline renderiza colunas; arrasto otimista move lead de etapa |
| E2E-04 Lead | `lead-details.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Abre lead pelo kanban, navega pelas abas; lead inexistente não quebra a UI |
| E2E-05 Guarda anônima | `unauth-guard.spec.ts` | Apenas `E2E_BASE_URL` | Rota protegida sem sessão redireciona para `/login` |
| 12B homologação autenticada | `homologation-auth.spec.ts`, `homologation-triage.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Rotas, responsividade, PWA, navegação e guards |
| 12C.5 transacional | `transactional-flow.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Lead → Venda → Contrato → Enrollment até `COMPLETED` |
| 2.5C matrículas | `enrollments.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Listagem responsiva (6 viewports) e detalhe de matrícula |
| 2.5D multi-enrollment | `enrollments.spec.ts` + fluxo | `E2E_EMAIL`/`E2E_PASSWORD` + `E2E_SERVICE_ROLE_KEY` | Mesmo Student com N Enrollments; status independentes; Student global coerente |
| 2.5D offline | `enrollments.spec.ts` (manual) | `E2E_EMAIL`/`E2E_PASSWORD` | `assertOnline` bloqueia; backend inalterado; reconexão funciona |
| 2.5D seller scope | `rbac.spec.ts` + manual | `E2E_EMAIL_RESTRICTED`/`E2E_PASSWORD_RESTRICTED` | VENDEDOR vê apenas suas Sales; sem ações acadêmicas; acesso direto negado |

## Decisões

- **Credenciais por variável de ambiente**, definidas em `tests/e2e/helpers.ts`.
- **Suíte otimista/não destrutiva**: o kanban valida o estado otimista após o drop;
  se a RPC de backend rejeitar (ex.: RLS), o rollback pode devolver o card — a
  suíte não assume persistência do arrasto.
- **Skips dinâmicos**: se o pipeline não tiver leads arrastáveis (ou etapas
  suficientes), o caso é pulado com mensagem explícita.
- **Selectors estáveis**: `data-testid` em colunas e cards do kanban
  (`kanban-column-*`, `kanban-card-*`, `kanban-card-*-drag`) e labels/aria
  existentes para login e 403.
- **Rastreabilidade**: trace, screenshot e video em falha (`test-results/`),
  ignorados pelo git.
- **Matrículas**: o fluxo transacional reutiliza o `RUN_ID` nas notas e motivos
  do cenário. Como o domínio não possui delete de Enrollment, a limpeza de
  dados persistidos deve ser manual e específica ao marcador, respeitando as
  FKs e sem `TRUNCATE` ou delete amplo.

## CI

A suíte E2E **não** roda no CI do PR (requer deploy e credenciais). É executada
manualmente contra o deploy candidato à release.

## Último checkpoint

- Playwright autenticado: validado contra o DEV com conta QA ADMIN.
- Playwright transacional: fluxo Lead→Venda→Contrato→Enrollment até `COMPLETED` validado.
- Playwright multi-enrollment: mesmo Student com N Enrollments independentes validado.
- Playwright offline: `assertOnline` bloqueia mutações; backend inalterado; reconexão funciona.
- Playwright seller scope: VENDEDOR QA vê apenas suas matrículas; sem ações acadêmicas; acesso direto negado.
- Responsividade: 6 viewports (320–1366px) sem overflow validados.
- Cleanup: determinístico por `RUN_ID` com `E2E_SERVICE_ROLE_KEY` (Node-only); 0 resíduos.
- Correções UX mobile: busca com espaços e cards sem overflow validadas no preview final.
- Playwright final do preview: 2 testes aprovados, cobrindo busca `QA Manual`, Matrículas, Vendas, Contratos, Alunos, detalhe e viewports 320x568, 360x800, 390x844 e 412x915.
- Espaçamento inferior validado com `safe-bottom` computado em 32px.
- Artefatos de falha (`test-results/`, traces, screenshots e vídeos) são ignorados pelo Git.
