# Profissionaliza Gestão

PWA de gestão integrada para a **Profissionaliza – Centro de Ensino Profissional**, em Santarém-PA.

Sistema completo de gestão cobrindo os domínios: **CRM**, Comercial, Vendas, Contratos, Matrículas, Alunos, Comissões, Pedagógico, Financeiro e Dashboards.

Este repositório é a **fonte oficial de verdade** do projeto. Todo o desenvolvimento futuro acontece por branches temporárias e Pull Requests direcionados à `main`.

## Stack

- React 19
- TypeScript (strict)
- Vite
- Tailwind CSS
- Supabase
- PostgreSQL (com Row Level Security)
- TanStack Query
- React Hook Form
- Zod
- PWA (Vite PWA)

## Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Conta e projeto Supabase

## Instalação

```bash
git clone https://github.com/Rodrigo-Kotlin/profissionaliza-gestao.git
cd profissionaliza-gestao
npm install
copy .env.example .env.local
npm run dev
```

No macOS/Linux, substitua o comando `copy` por `cp`.

## Variáveis de ambiente

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Nunca inclua valores reais no repositório. A chave `anon` é pública por definição e opera sob RLS. Nunca coloque `service_role`, senha do banco ou outros segredos em variáveis `VITE_*`.

Sem essas variáveis, a aplicação inicia e informa que o ambiente de autenticação não está configurado.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento local |
| `npm run lint` | Lint com ESLint |
| `npm run typecheck` | Verificação de tipos TypeScript |
| `npm run build` | Build de produção |
| `npm run preview` | Pré-visualização do build |
| `npm run format` | Formatação com Prettier |

## Estrutura

```text
src/
  app/                 providers globais
  components/          marca e componentes compartilhados
    ui/                primitives do design system
  features/            funcionalidades organizadas por domínio
  layouts/             app shell responsivo
  lib/                 Supabase, RBAC e utilitários
  routes/              router e proteção de rotas
  services/            serviços transversais, incluindo auditoria
  types/               contratos de domínio
supabase/
  migrations/          schema, funções, triggers e RLS
  seed.sql              dados fictícios (papéis, permissões e configurações)
docs/                  documentação técnica
```

Consulte `docs/ARCHITECTURE.md` para detalhes.

## Banco

O schema é versionado como migrations do Supabase em `supabase/migrations/`. A evolução do banco deve sempre ocorrer via nova migration — migrations já aplicadas não devem ser modificadas retrospectivamente.

Consulte `docs/DATABASE.md` para o guia de migrations e `docs/RBAC.md` para o modelo de acesso.

## Segurança

- **RLS**: toda tabela tem Row Level Security habilitado no banco.
- **RBAC**: controle de acesso por papéis e permissões, reforçado no banco, não apenas na UI.
- **LGPD**: o repositório nunca deve conter dados reais de alunos, CPFs, telefones ou dados financeiros.
- **Secrets**: nunca versionar `.env`, `service_role` ou qualquer credencial.

Reporte vulnerabilidades de forma privada — veja `SECURITY.md`.

## Desenvolvimento

- Crie uma branch a partir da `main`: `feature/<descricao>`, `fix/<descricao>`, etc.
- Implemente e valide localmente (`lint`, `typecheck`, `build`).
- Abra um Pull Request para a `main`.
- A CI executa automaticamente lint, typecheck e build.

Veja `CONTRIBUTING.md` para o fluxo completo.

## Remote Supabase Development

O banco de desenvolvimento é gerenciado diretamente no projeto remoto do Supabase. Docker não é necessário neste workflow.

### Conexão

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

### Migrations

```bash
# Verificar status local vs remoto
npx supabase migration list

# Preview antes de aplicar
npx supabase db push --dry-run

# Aplicar migrations
npx supabase db push

# Criar nova migration
npx supabase migration new <nome>
```

### Tipos TypeScript

```bash
# Gerar tipos a partir do schema remoto
npx supabase gen types --lang typescript --linked > src/types/database.types.ts
```

Consulte `docs/DATABASE.md` para detalhes sobre migrations e `docs/ARCHITECTURE.md` para a visão geral do schema.

## Licença

Código **proprietário**. Nenhuma licença open source é concedida enquanto não houver decisão formal em contrário.

## Rotas

- `/login` — autenticação com Supabase
- `/recuperar-senha` — solicitação de recuperação
- `/redefinir-senha` — definição de nova senha
- `/` — dashboard executivo protegido
- `/perfil` — edição do perfil autenticado
- `/administracao/usuarios` — diretório protegido por permissão
- `/em-breve` — estado explícito para módulos futuros
