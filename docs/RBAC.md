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

O seed (`supabase/seed.sql`) define as permissões padrão de cada papel. `ADMIN` recebe todas as permissões.

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

## LGPD

Nunca versionar dados pessoais reais. Seeds devem usar exclusivamente nomes claramente fictícios, sem CPF, telefone, e-mail real de aluno ou dados financeiros.
