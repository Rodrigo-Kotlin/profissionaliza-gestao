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

A segurança é aplicada **no banco**, nunca apenas na UI.

## PWA

- Manifest e service worker gerados no build.
- Service worker armazena somente assets estáticos do app shell. Sem runtime cache de APIs, sessões ou dados pessoais.

## Organização por features

- Cada domínio vive em `src/features/<dominio>/`.
- Nomeações consistentes: `<dominio>-page.tsx`, `<dominio>-service.ts`, etc.
- Dependência unidirecional: UI consome serviços, serviços consomem o client.

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
