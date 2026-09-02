# Roadmap

## Fase 1 — Fundação
**Status: concluída**

Autenticação, RBAC, shell responsivo, dashboard executivo, administração inicial, auditoria e PWA.

## Fase 2.1 — Master Data: pessoas, alunos e responsáveis
**Status: concluída**

`people` como identidade central; `students` e `student_guardians` com RPCs de
domínio, RLS por permissão e masking LGPD no back end (ver `docs/DATABASE.md` e
`docs/RBAC.md`). Branch: `feature/master-data-people-students`.

## Fase 2 — Cadastros mestres e núcleo acadêmico
**Status: em desenvolvimento

- Pessoas
- Alunos
- Cursos
- Matrizes
- Disciplinas
- Turmas
- Matrículas

Branch: `feature/master-data`

## Fase 3 — CRM e Comercial

CRM, leads, funil, vendas e atendimento.

## Fase 4 — Contratos e Financeiro

Contratos, comissões, contas a receber, cobranças e recebimentos.

## Fase 5 — Operação Pedagógica

Operação acadêmica: turmas, aulas, frequência e acompanhamento.

## Fase 6 — Dashboards, relatórios e automações

Indicadores, relatórios exportáveis e automações de processos.

---

### Versionamento sugerido

| Versão | Entrega |
| --- | --- |
| `v0.1.0` | Fundação |
| `v0.2.0` | Cadastros Mestres |
| `v0.3.0` | Comercial |
| `v0.4.0` | Financeiro |
| `v0.5.0` | Pedagógico |
| `v1.0.0` | MVP homologado |

Tags são criadas apenas quando associadas a uma entrega correspondente.
