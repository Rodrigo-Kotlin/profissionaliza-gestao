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
# Conta com acesso amplo (CRM, pipeline, cursos, usuários)
export E2E_EMAIL="admin@instituicao.com.br"
export E2E_PASSWORD="..."
# Conta restrita SEM courses.view (valida o 403 de rota)
export E2E_EMAIL_RESTRICTED="recepcao@instituicao.com.br"
export E2E_PASSWORD_RESTRICTED="..."

# 3) Rodar
npm run test:e2e
```

> Credenciais vão apenas como variáveis de ambiente — nunca no repositório.
> Os testes usam dados **reais** do ambiente (nunca dados pessoais reais em staging).

## Matriz de execução

| Fluxo | Arquivo | Requer | O que valida |
| --- | --- | --- | --- |
| E2E-01 Login | `login.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Login admin, dashboard e menu; credenciais inválidas não autenticam |
| E2E-02 RBAC | `rbac.spec.ts` | `E2E_EMAIL_RESTRICTED`/`E2E_PASSWORD_RESTRICTED` | Usuário sem `courses.view` recebe 403 genérico em `/crm/cursos`, sem vazar conteúdo/permissões |
| E2E-03 Kanban | `kanban.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Pipeline renderiza colunas; arrasto otimista move lead de etapa |
| E2E-04 Lead | `lead-details.spec.ts` | `E2E_EMAIL`/`E2E_PASSWORD` | Abre lead pelo kanban, navega pelas abas; lead inexistente não quebra a UI |
| E2E-05 Guarda anônima | `unauth-guard.spec.ts` | Apenas `E2E_BASE_URL` | Rota protegida sem sessão redireciona para `/login` |

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

## CI

A suíte E2E **não** roda no CI do PR (requer deploy e credenciais). É executada
manualmente contra o deploy candidato à release.