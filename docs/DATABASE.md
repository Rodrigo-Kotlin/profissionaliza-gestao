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

## Fase 2.1 — Master Data (pessoas, alunos, responsáveis)

### Identidade central `people`

`public.people` é a identidade central de qualquer pessoa do sistema. Uma pessoa
existe **uma única vez**; os dados pessoais **não** são duplicados em `students`.
A tabela `students` referencia `people` por `people_id` e contém apenas atributos
de aluno (código, status, data de registro, origem, observações).

### Masking de dados sensíveis (LGPD)

O masking é decidido **no backend** por meio de RPCs `SECURITY DEFINER`:

- Usuários com `students.view` recebem CPF/telefone/whatsapp/e-mail/endereço
  **mascarados**.
- Apenas quem possui `students.view_sensitive` recebe os valores completos.
- O frontend **nunca** recebe o valor completo para mascarar — ele apenas exibe o
  que o back end retorna.
- `public.people` **não** possui `select` direto para `authenticated`.
- As funções de masking são `mask_cpf`, `mask_phone` e `mask_email` (no banco).

### RPCs de domínio (acesso controlado)

Leituras e escritas de alunos/responsáveis ocorrem por RPCs, não por
`select * from people`:

| Função | Permissão exigida | Finalidade |
| --- | --- | --- |
| `create_student` | `students.create` | Cria aluno reutilizando `people` por CPF |
| `update_student` | `students.edit` | Edita dados da pessoa (CPF imutável) |
| `change_student_status` | `students.manage_status` | Transição de status + histórico + motivo |
| `search_students` | `students.view` | Busca filtrada/paginada + masking |
| `get_student_detail` | `students.view` | Perfil completo + masking |
| `list_guardians` | `guardians.view` | Responsáveis de um aluno |
| `link_guardian` / `unlink_guardian` | `guardians.manage` | Vínculo/desvínculo de responsável |
| `get_student_history` | `students.view` | Histórico de status |
| `student_kpis` | `dashboard.view` | Indicadores reais de alunos |

Todas as RPCs validam `auth.uid()`, checam permissão via `has_permission`,
definem `search_path = pg_catalog, public`, `set row_security = off` e concedem
`execute` apenas para `authenticated` (com revoke para `public`/`anon`).

### Regras de domínio

- **CPF** é normalizado (11 dígitos) com partial unique index `WHERE cpf IS NOT NULL`.
- **Aluno** (student) tem código `ALU-YYYY-NNNNNN` via sequence `student_code_seq`.
- **Status**: `PRE_CADASTRO`, `ATIVO`, `INATIVO`, `CANCELADO`, `CONCLUIDO`.
  - `students.manage_status` exige **motivo** para `INATIVO`, `CANCELADO` e `CONCLUIDO`.
- **Responsáveis**: `student_guardians` tem `unique(student_id, guardian_person_id)`,
  no máximo 1 `is_primary_contact = true` e 1 `is_financial_responsible = true`
  por aluno (partial unique indexes).
- **Auditoria** registra apenas `fields_changed`, status, código e ids — **nunca**
  CPF/RG/telefone completo/endereço em metadata.

### Migrations desta fase

```text
supabase/migrations/20260902000100_phase2_1_people_students.sql
supabase/migrations/20260902100000_phase2_1_student_update.sql
```

Ambas já aplicadas ao remoto DEV (linked ref `epjshcgsjvrydwuyqixi`).

## Cuidado com db reset remoto

**NÃO** executar `npx supabase db reset --linked` sem autorização explícita. Esse comando é destrutivo. Mesmo em DEV, pedir confirmação antes.
