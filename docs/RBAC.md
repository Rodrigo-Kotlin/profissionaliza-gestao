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

## LGPD

Nunca versionar dados pessoais reais. Seeds devem usar exclusivamente nomes claramente fictícios, sem CPF, telefone, e-mail real de aluno ou dados financeiros.
