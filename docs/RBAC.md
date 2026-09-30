# RBAC — Controle de Acesso Baseado em Papéis

## Perfis

| Perfil | Descrição |
| --- | --- |
| `ADMIN` | Acesso administrativo integral ao sistema. |
| `DIRECAO` | Visão executiva e gestão institucional. |
| `GERENTE_COMERCIAL` | Gestão da operação comercial. |
| `VENDEDOR` | Atendimento e operação de vendas. |
| `FINANCEIRO` | Cobranças, recebimentos e gestão financeira. |
| `PEDAGOGICO` | Gestão acadêmica e pedagógica. |
| `PROFESSOR` | Turmas, aulas e frequência. |
| `RECEPCAO` | Atendimento e apoio operacional. |

## Princípio

A segurança deve existir **no banco (RLS)** e não apenas na UI. A interface pode esconder controles, mas a autorização real é aplicada pelas políticas de acesso no PostgreSQL através das funções:

- `has_role(role_code)`
- `has_permission(permission_code)`
- `is_admin()`
- `get_my_permissions()`

Essas funções usam `SECURITY DEFINER`, `search_path` fixo e grants mínimos.

## Modelo

```text
profiles
roles
permissions
role_permissions
user_roles
```

- `roles` — papéis do sistema (lista acima).
- `permissions` — permissões granulares por módulo (`crm.view`, `sales.create`, `finance.receive`, etc.).
- `role_permissions` — associação papel → permissão.
- `user_roles` — associação usuário → papel.
- `profiles` — perfil do usuário autenticado.

O RBAC é materializado por **migrations** em `supabase/migrations/`
(`supabase/migrations/20260910120000_phase2_2_1_rbac_consistency.sql`), que criam
classes, permissões e a matriz `role_permissions` de forma idempotente. O seed
(`supabase/seed.sql`) **não manipula RBAC** — ele apenas insere dados de demonstração.
`ADMIN` recebe todas as permissões. As permissões de módulos futuros (`sales.*`,
`finance.*`, `rbac.view`, etc.) já estão materializadas para evitar gaps quando as
rotas forem liberadas.

## Fase 2.2.1 — Guarda de rotas

A autorização também é aplicada **no front-end** em nível de rota, de forma
defensiva (nunca substitui a RLS):

- `AuthRoute` — exige sessão; redireciona não autenticados para `/login` após o
  carregamento dos dados de acesso (spinner "Validando acesso..." evita flash).
- `PermissionRoute` — exige sessão **e** permissão; renderiza um 403 genérico
  ("Você não tem acesso a esta área") que não revela permissão, papel ou rota interna.
- `can()` / `canAny()` — checagens pontuais de permissão.

Exemplos de rotas guardadas em `src/routes/router.tsx`:

| Rota | Permissão exigida |
| --- | --- |
| `/` | `dashboard.view` |
| `/alunos` | `students.view` |
| `/alunos/novo` | `students.create` |
| `/crm` | `crm.view` |
| `/crm/cursos` | `courses.view` |
| `/administracao/usuarios` | `users.view` **ou** `users.manage` |

`rbac.view` habilita o futuro gerenciamento de papéis e não é atribuído a nenhum
papel nesta fase.

## Fase 2.1 — Permissões de Pessoas/Alunos/Responsáveis

Novas permissões introduzidas nesta fase:

| Código | Descrição |
| --- | --- |
| `people.view` | Consultar pessoas (via RPC de contexto) |
| `people.create` / `people.edit` | Criar/editar pessoas |
| `students.view` | Listar/detalhar alunos (com masking LGPD) |
| `students.create` | Criar aluno |
| `students.edit` | Editar dados do aluno |
| `students.manage_status` | Alterar status do aluno (com motivo) |
| `students.view_sensitive` | Acessar dados sensíveis completos de alunos |
| `guardians.view` / `guardians.manage` | Ver/gerir responsáveis |

### Matriz por papel

| Permissão | ADMIN | DIRECAO | PEDAGOGICO | RECEPCAO | VENDEDOR | FINANCEIRO | PROFESSOR |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `people.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `people.create` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `people.edit` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `students.view` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `students.create` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| `students.edit` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `students.manage_status` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `students.view_sensitive` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `guardians.view` | ✅ | ✅ | ✅ | ✅ | — | ✅ | — |
| `guardians.manage` | ✅ | ✅ | ✅ | ✅ | — | — | — |

**Nota sobre sensibilidade:** usuários com apenas `students.view` recebem CPF,
telefone, whatsapp, e-mail e endereço **mascarados** no back end. Apenas
`students.view_sensitive` recebe valores completos. O menu "Alunos" fica visível
apenas para quem possui `students.view`.

## Fase 2.4 — Permissões de Contracts

Novas permissões introduzidas nesta fase:

| Código | Descrição |
| --- | --- |
| `contracts.view` | Ver contratos (list/detail/timeline) de contratos próprios |
| `contracts.view_all` | Ver contratos de todas as vendas/vendedores |
| `contracts.view_sensitive` | Ver snapshots de dados sensíveis do contratante |
| `contracts.create` | Gerar contrato a partir de sale CONFIRMED |
| `contracts.edit_draft` | Editar rascunho (DRAFT) |
| `contracts.issue` | Emitir (DRAFT → PENDING_SIGNATURE) |
| `contracts.mark_signed` | Registrar assinatura (→ SIGNED) |
| `contracts.cancel` | Cancelar (com motivo) |

### Matriz por papel

| Permissão | ADMIN | DIRECAO | GERENTE_COMERCIAL | RECEPCAO | VENDEDOR | FINANCEIRO | PEDAGOGICO | PROFESSOR |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `contracts.view` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `contracts.view_all` | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `contracts.view_sensitive` | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `contracts.create` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `contracts.edit_draft` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `contracts.issue` | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `contracts.mark_signed` | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| `contracts.cancel` | ✅ | ✅ | ✅ | — | — | — | — | — |

**Regras de acesso:**

- `VENDEDOR` opera apenas contratos de vendas **próprias** (ownership via
  `seller_user_id`); `contracts.create`/`edit_draft` sem `view_all` ainda exigem
  ser o vendedor dono da venda.
- `RECEPCAO` cadastra contratantes via `people.create` (pode cria DRAFT e emitir,
  mas **não** cancela).
- `FINANCEIRO`, `PEDAGOGICO` e `PROFESSOR` não recebem permissões de contracts.
- `contracts.view_sensitive` controla CPF/telefone/e-mail completos do
  contratante no detalhe; sem ela o frontend exibe o valor mascarado retornado
  pelo back end.

## LGPD

Nunca versionar dados pessoais reais. Seeds devem usar exclusivamente nomes claramente fictícios, sem CPF, telefone, e-mail real de aluno ou dados financeiros.
