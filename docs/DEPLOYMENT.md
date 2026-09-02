# Deployment — Cloudflare Pages + Supabase

Guia de publicação do **Profissionaliza Gestão**. O frontend é um SPA/PWA (React 19 + Vite) publicado via **Cloudflare Pages** conectado ao GitHub. O backend (PostgreSQL + Auth/RLS/RBAC) permanece no **Supabase**.

Nenhuma alteração é feita no banco por este processo — deploys de schema continuam via migrations do Supabase (`npx supabase db push`), conforme `docs/DATABASE.md`.

## Índice

1. [Arquitetura de deployment](#arquitetura-de-deployment)
2. [Pré-requisitos](#pré-requisitos)
3. [Preparação do repositório](#preparação-do-repositório)
4. [Configuração no Cloudflare Dashboard](#configuração-no-cloudflare-dashboard)
5. [Variáveis de ambiente](#variáveis-de-ambiente)
6. [Configuração de Auth no Supabase](#configuração-de-auth-no-supabase)
7. [Roteamento SPA e headers](#roteamento-spa-e-headers)
8. [Node versão](#node-versão)
9. [Validando antes de publicar](#validando-antes-de-publicar)
10. [Publicação e previews](#publicação-e-previews)
11. [Checagem pós-publicação](#checagem-pós-publicação)
12. [Segurança](#segurança)
13. [Ambientes futuros](#ambientes-futuros)

## Arquitetura de deployment

```
GitHub (main) ──► Cloudflare Pages (Git Integration)
   │                    │ build: npm run build
   │                    │ output: dist/
   │                    │ Node 20
   └── env (VITE_*)     └── hosting estático + PWA
                              │
                              ▼
                    Supabase (URL + anon key)
                    Auth · RLS · RBAC · schema
```

- **Git Integration** é o mecanismo de deploy único. Não há etapa de deploy na GitHub Actions (a CI existente executa apenas lint/typecheck/test/build).
- Cada **branch** e **Pull Request** gera um **preview** com URL própria (`<hash>.<project>.pages.dev`).
- O branch de produção é `main`.

## Pré-requisitos

- Conta **Cloudflare** com acesso ao dashboard.
- Repositório GitHub `Rodrigo-Kotlin/profissionaliza-gestao` (este).
- Projeto Supabase DEV (URL + chave `anon`).
- Acesso ao dashboard do Supabase para ajustar Auth.

## Preparação do repositório

Os arquivos já incluídos:

- `public/_redirects` — roteamento SPA (qualquer rota cai em `index.html`).
- `public/_headers` — headers de segurança (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`).
- `.node-version` (`20`) + `engines.node` no `package.json` — consistência de versão em local/CI/Cloudflare.
- `VITE_APP_ENV` — seletor de ambiente (selo "DEV" em dev/homologação).
- `src/lib/env.ts` — helper central de ambiente.

Garanta que `.env.local` esteja ignorado (já está) e que nenhum segredo seja versionado.

## Configuração no Cloudflare Dashboard

1. Acesse **Workers & Pages → Create → Pages → Connect to Git**.
2. Autorize o GitHub App para o repositório `Rodrigo-Kotlin/profissionaliza-gestao` (se ainda não autorizado).
3. Configure o projeto:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
   - **Build system / Node**: versão 20 (ou `20` em `.node-version`)
4. Salve o projeto. O nome gerado define a URL — registre o hostname real (ex.: `profissionaliza-gestao.pages.dev`).

Uma primeira build será disparada automaticamente ao conectar.

## Variáveis de ambiente

Configure no dashboard (**Settings → Environment Variables**) para **ambos** os ambientes (Production e Preview/Pull Requests), ambas apontando para o Supabase **DEV**:

| Variável | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL do projeto Supabase DEV (ex.: `https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Chave **anon** pública do projeto DEV |
| `VITE_APP_ENV` | `development` (mostra o selo DEV) |

> Nunca use `service_role`, senha do banco ou tokens no frontend. A chave `anon` é pública e os acessos são controlados por RLS/RBAC/RPC.

Após salvar, **redeploy/rebuild** do projeto para que as variáveis sejam injetadas.

## Configuração de Auth no Supabase

No **dashboard do Supabase → Authentication → URL Configuration** (projeto DEV):

- **Site URL**: `https://<project>.pages.dev` (o hostname real do Pages).
- **Redirect URLs** — adicione:
  - `http://localhost:5173/**` (desenvolvimento local)
  - `https://<project>.pages.dev/**` (produção DEV)
  - `https://**.pages.dev/**` (previews de branches/PRs)

A recuperação de senha redireciona para `/redefinir-senha` usando `window.location.origin` (não há `localhost` hardcoded nos fluxos publicados). O app usa `detectSessionInUrl` para capturar o token de recuperação na URL.

**Cadastro público**: sistema interno — mantenha o signup público desabilitado/restrito no Supabase (não alterar sem validação).

## Roteamento SPA e headers

- `public/_redirects`:
  ```
  /*    /index.html   200
  ```
  Garante que rotas como `/alunos`, `/alunos/novo`, `/alunos/:id`, `/perfil`, `/administracao/usuarios` sirvam o `index.html`.

- `public/_headers`:
  ```
  /*
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    X-Frame-Options: DENY
  ```

  Este conjunto é seguro e não interfere com Supabase/PWA. Não adote CSP agressivo sem teste completo (Supabase, PWA, fontes, scripts).

## Node versão

| Local | CI (GitHub Actions) | Cloudflare Pages |
| --- | --- | --- |
| Node 20 | `node-version: 20` | Build system: Node 20 |

`vite` 7 exige Node `^20.19.0 || >=22.12.0` — a linha 20.x atual (≥20.19) atende. `engines.node` e `.node-version` ajudam a pinar a versão.

## Validando antes de publicar

Localmente, na raiz do repositório:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Todos devem passar. O `dist/` deve conter `_redirects` e `_headers` copiados de `public/`.

```bash
dir dist\_redirects dist\_headers
```

## Publicação e previews

- **Produção**: merges em `main` disparam build automática e publicam o hostname de produção.
- **Preview**: cada push/PR gera uma URL temporária (`https://<hash>.<project>.pages.dev`) — ideal para revisar antes do merge.

O deploy do frontend não altera o banco. Evite cache agressivo (nunca cachear Supabase/Auth/dados).

## Checagem pós-publicação

1. Acesse o hostname real; entre com credenciais válidas.
2. Valide rotas profundas diretamente (recarregue): `/`, `/login`, `/alunos`, `/alunos/novo`, `/alunos/:id`, `/perfil`, `/administracao/usuarios`.
3. Teste o fluxo de recuperação de senha no URL publicado: solicitar → e-mail → abrir link → `/redefinir-senha` → atualizar → login.
4. Verifique PWA: manifest, service worker, ícones.
5. Responsividade mobile (390–1920px), Lighthouse, rede/console sem erro — sem *mixed content*, sem 404, sem chamadas a `localhost`.
6. Confirme o selo "DEV" no app shell (indicador de homologação).

## Segurança

- **Nunca versionar** `.env`, `service_role`, senha de banco, tokens Cloudflare/GitHub.
- Dependência de autorização está no Supabase (Auth/RLS/RBAC/RPC), não na UI.
- `public/_headers` aplica headers de segurança básicos.
- Reporte vulnerabilidades de forma privada — veja `SECURITY.md`.

## Ambientes futuros

Para produção final, basta:

1. Definir `VITE_APP_ENV=production` (e demais `VITE_*` do projeto de produção) nos ambientes Production/Preview do Pages.
2. Ajustar Site URL e Redirect URLs no Supabase de produção.
3. Sem mudança de código — `isDevEnvironment` deixa de exibir o selo DEV automaticamente.