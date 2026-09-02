# Contribuindo

Obrigado pelo interesse em contribuir com o **Profissionaliza Gestão**.

## Fluxo de trabalho

1. **Nunca trabalhe diretamente na `main`** para funcionalidades relevantes.
2. Crie uma branch a partir da `main`.
3. Implemente a alteração.
4. Valide localmente.
5. Faça o commit com mensagem seguindo Conventional Commits.
6. Envie a branch para o remoto.
7. Abra um Pull Request para a `main`.
8. Aguarde a CI passar e a revisão ser concluída.
9. Faça o merge (squash). Após o merge, a branch pode ser excluída.

## Branches

Use branches temporárias com prefixo semântico:

- `feature/<descricao>`
- `fix/<descricao>`
- `refactor/<descricao>`
- `chore/<descricao>`
- `docs/<descricao>`

Exemplos:

```text
feature/master-data
feature/crm
fix/login-session
chore/github-ci
```

Evite nomes como `teste`, `nova`, `branch1`, `final`.

## Conventional Commits

Adote [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add student master data
feat(crm): implement lead pipeline
fix(auth): restore session after refresh
fix(rls): restrict student document access
refactor(finance): extract installment service
docs: add database architecture
test: add enrollment rules tests
chore: configure github actions
```

## Validação local

Antes de abrir o Pull Request, garanta que tudo passa:

```bash
npm run lint
npm run typecheck
npm run build
```

## Migrations

- Toda alteração estrutural no banco deve ocorrer via **nova migration**.
- Jamais modifique retrospectivamente uma migration já aplicada — crie uma nova (`supabase/migrations/YYYYMMDDHHMMSS_descricao.sql`).
- Seeds devem conter apenas **dados fictícios**.

## Segurança e LGPD

- Nunca adicione secrets, credenciais ou `.env` ao repositório.
- Nunca adicione dados pessoais reais (CPF, telefones, e-mails de alunos, dados financeiros).
- Revise RLS quando alterar o banco.
