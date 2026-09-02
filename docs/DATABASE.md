# Banco de Dados

## Visão geral

O banco utiliza **Supabase/PostgreSQL** com migrations versionadas em `supabase/migrations/`. O histórico Git deve permitir reconstruir a evolução do banco.

## Migrations

Cada migration cria/alteram o schema de forma idempotente e versionada por nome com timestamp:

```text
supabase/migrations/
  20260831000100_phase1_foundation.sql
```

### Conexão remota

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

Docker não é necessário neste workflow. Toda validação de banco ocorre contra o projeto Supabase remoto DEV.

### Executar migrations

```bash
# Verificar status local vs remoto
npx supabase migration list

# Preview antes de aplicar (obrigatório)
npx supabase db push --dry-run

# Aplicar migrations
npx supabase db push
```

### Criar nova migration

Nunca modifique retrospectivamente uma migration já aplicada. Sempre crie uma nova:

```bash
npx supabase migration new <descricao>
```

Padrão de nome: `YYYYMMDDHHMMSS_<descricao>.sql`.

### Popular seed

Execute `supabase/seed.sql` pelo SQL Editor ou por um fluxo de seed local. O seed contém **apenas dados fictícios**: papéis, permissões e configurações básicas.

### Primeira conta ADMIN

1. Crie o primeiro usuário pelo Supabase Auth.
2. Atribua o papel `ADMIN` pelo SQL Editor com contexto privilegiado:

```sql
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from auth.users u
cross join public.roles r
where u.email = 'admin@exemplo.com'
  and r.code = 'ADMIN'
on conflict do nothing;
```

Depois do bootstrap, a gestão de RBAC deve ocorrer apenas por usuários com `users.manage`.

## Princípios de modelagem

- **UUID** como chave primária.
- **Timestamps** `created_at` / `updated_at` em todas as tabelas.
- **RLS habilitado** em toda tabela.
- **Soft delete** para dados operacionais quando aplicável.
- Sem PII desnecessária; valores sensíveis protegidos por RLS.

## Convenções

- Nomes de tabelas em `snake_case`, plural.
- Constraints e índices nomeados de forma explícita.
- Funções `SECURITY DEFINER` apenas quando necessário, com `search_path` fixo e grants mínimos.

## RLS

Políticas baseadas em `has_role`, `has_permission`, `is_admin` e `get_my_permissions`. O acesso é definido no banco, nunca apenas na UI. Ver `docs/RBAC.md`.

## Gerar tipos TypeScript

Após aplicar migrations, gerar os tipos a partir do schema remoto:

```bash
npx supabase gen types --lang typescript --linked > src/types/database.types.ts
```

O arquivo `src/types/database.types.ts` é gerado automaticamente e não deve ser editado manualmente. O client Supabase em `src/lib/supabase.ts` utiliza esses tipos para queries tipadas.

## Seed

`supabase/seed.sql` contém apenas dados fictícios. Nunca versionar dumps de produção, backups ou credenciais.

## Cuidado com db reset remoto

**NÃO** executar `npx supabase db reset --linked` sem autorização explícita. Esse comando é destrutivo. Mesmo em DEV, pedir confirmação antes.
