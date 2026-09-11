# Auditoria E2E — Venda → Contrato (Fase 2.4)

- **Branch**: `feature/contracts-phase-2-4` (PR #14)
- **Escopo**: fluxo `Venda fechada → Wizard → Contrato (DRAFT → Emitido → Assinado)`, reuso de dados de People, CEP automático com fallback manual, LGPD/RBAC.
- **Data**: 2026-09-11
- **Status**: `FASE 2.4 CONTRACTS — AUDITORIA E2E CONCLUÍDA, AGUARDANDO HOMOLOGAÇÃO`

---

## 1. Resumo Executivo

O wizard de criação de contrato **não reutilizava dados já existentes** da venda/aluno: exigia busca manual por nome/CPF (mínimo 2 caracteres), sem pré-seleção, sem sugestionar responsáveis e sem carregar a ficha do contratante. Além disso, o botão "Cadastrar novo contratante" era exibido com base apenas em `contracts.create`, enquanto a RPC `create_person` exige `people.create` — gerando erro de permissão para papeis comerciais.

As correções implementadas nesta auditoria:

1. **Pré-seleção do aluno como contratante** usando `sale.person_id` / `sale.full_name` já retornados por `get_sale_detail`.
2. **Nova RPC `get_contractor_detail`** — dados cadastrais da pessoa com mascaramento PII decidido no PostgreSQL (`contracts.view_sensitive`).
3. **Nova RPC `update_person`** — atualização parcial (paritária) de People no domínio Identity (não acoplada a alunos), com `people.edit` e gate sensível (mesmo padrão do `update_student`).
4. **Completude orientada a dados**: badge "completos/incompletos" + formulário que solicita **apenas campos faltantes** (sem redigitação).
5. **Sugestão de responsáveis do aluno** (`list_guardians`) condicionada a `guardians.view`.
6. **Busca automática de CEP (ViaCEP)** com debounce, cache em sessão, fallback manual e campos `número`/`complemento` nunca auto‑preenchidos.
7. **Correção do bug de permissão** em `ContractorSearch`/wizard/edição de rascunho (`canCreate = contracts.create AND people.create`).

Qualidade: `typecheck`, `lint` (0 warnings), **288 testes** (+21) e `build` OK. Migration `20260911120000` aplicada no Supabase DEV (`local = remote`).

O contrato **não** é bloqueado por dados incompletos: o DRAFT é o estado de conferência/complementação (a state machine `DRAFT → PENDING_SIGNATURE → SIGNED` é preservada).

---

## 2. Fluxo Atual (antes e depois)

**Antes**

```text
Venda fechada → detalhe → "Gerar contrato"
  → Passo 1: busca manual ≥2 chars (zero reuso de dados)
  → seleção → revisão → create_contract_from_sale → DRAFT
```

**Depois**

```text
Venda fechada → detalhe → "Gerar contrato"
  → Passo 1 abre com o ALUNO pré-selecionado (sale.person_id)
  → get_contractor_detail carrega a ficha (mascarada conforme permissão)
  → badge de completude; completa apenas campos faltantes
    (update_person; somente com people.edit; CEP automático)
  → sugestão de responsáveis (guardians.view) p/ troca em 1 clique
  → revisão exibe Contato + Endereço do contratante
  → create_contract_from_sale → DRAFT → Emitir → Assinado
```

---

## 3. Data Lineage

| Origem | Destino | Mecanismo |
| --- | --- | --- |
| `crm_leads.person_id` | `people` | Person do lead reutilizada ao fechar a venda |
| `students.person_id` | `people` | 1 aluno = 1 pessoa (identidade canônica) |
| `sales.student_id` | `students` | Venda referencia o aluno |
| `sales.person_id` | `people` | Pessoa do cliente/aluno (usada p/ pré-selecionar contratante) |
| `sales.course_id` | `courses` | Curso (snapshot no contrato) |
| `contracts.student_id` | `students` | Aluno do contrato |
| `contracts.contractor_person_id` | `people` | Quem assina (aluno ou responsável) |
| `contracts.contractor_*` snapshots | — | Dados do contratante congelados no issue |

Princípio: **Person é a identidade canônica e nunca é duplicada**; `create_person` reutiliza por CPF (flag `reused`).

---

## 4. Problemas Encontrados

| ID | Severidade | Etapa | Problema | Causa | Impacto | Correção |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | BLOCKER | Wizard | Contratante não pré-selecionado; busca manual obrigatória | Wizard não usava `sale.person_id` | Redigitação, retrabalho e erros de cadastro | Pré-seleção do aluno no `useEffect` de abertura (wizard) |
| C-02 | HIGH | Wizard/Edição | Botão "Cadastrar novo contratante" visível sem `people.create` | `canCreate` usava só `contracts.create` | Erro `42501` para GERENTE_COMERCIAL/VENDEDOR | `canCreate = contracts.create AND people.create` |
| C-03 | HIGH | Wizard | Sem RPC de detail de pessoa | Inexistente | Wizard sem ficha para conferência/completude | `get_contractor_detail` + `useContractorDetail` |
| C-04 | HIGH | DRAFT | Impossível completar dados de People existente no fluxo | `update_student` acoplado a alunos e exigente de `students.edit` | VENDEDOR/RECEPÇÃO não consegue completar contratante sem cadastrar duplicado | `update_person` (domínio Identity, `people.edit`, parcial) |
| C-05 | MEDIUM | Wizard | Sem sugestão de responsáveis do aluno | Inexistente | Responsável financeiro digitado manualmente (erro) | `list_guardians` gated por `guardians.view` |
| C-06 | MEDIUM | People/CEP | Sem busca automática de CEP | Inexistente (sem adaptador) | Endereço manual com erros | Adapter ViaCEP + `useCepLookup` + fallback manual |
| C-07 | MEDIUM | CEP | `normalizeCep` removia zeros à esquerda (`01001-000 → 1001000`) | Strip `^0+` em `students-utils` | Lookup inválido para CEPs de capitais (SP etc.) | `normalizeCepDigits` preserva os 8 dígitos no lookup |
| C-08 | INFO | update_person | Semântica de "limpar campo" | `''` vs `null` ambíguos | Risco de limpar campos sem intenção | RPC: `null` = não altera, `''` = limpa; frontend envia só campos preenchidos |

---

## 5. Lead

Sem alteração. O lead WON mantém vínculo com a venda e a persona (`person_id`) é reutilizada — sem duplicação.

## 6. People

- Identidade canônica; `create_person` reutiliza por CPF (`reused`).
- Novo `update_person` cobre edição parcial sem duplicar e sem tocar CPF (chave de identidade).
- Mascaramento de `email/phone/whatsapp/CPF/RG/endereço` definido somente no PostgreSQL.

## 7. Student

`get_sale_detail` já retorna `person_id`, `full_name`, `student_id`, `student_code` — fonte da pré-seleção. Nenhuma mudança de modelo necessária.

## 8. Guardians

`list_guardians` já existia; agora o wizard sugere responsáveis (1 clique) **somente com `guardians.view`** (VENDEDOR não possui → seção simplesmente não é renderizada).

## 9. Sale

`get_sale_detail` cobre valores, desconto, pagamento, parcelas, vendedor e curso — usados na revisão do contrato.

## 10. Contract Wizard

- Pré-seleciona aluno na abertura.
- Painel "DADOS DO CONTRATANTE" com ficha carregada, CPF/contato resumido e badge de completude.
- Troca de contratante mantida (busca + responsáveis + cadastro).
- Passo de revisão ganhou "Contato" e "Endereço".

## 11. Data Reuse

| Cenário | Reuso |
| --- | --- |
| Aluno é o contratante | Pronto: pré-selecionado, sem digitação |
| Pessoas já existentes | `search_contractor_people` (dedup por CPF/identidade) |
| Pessoa já cadastrada (CPF) via modal | `create_person` retorna `reused=true` e o contrato aponta para a existente |
| Responsável financeiro | Sugestão `list_guardians` |
| Ficha incompleta | Só campos faltantes são solicitados |

## 12. CEP / Endereço

- `src/services/address/cep-service.ts` — adapter via `CepProvider` (ViaCEP por padrão), resultado `ok | not_found | invalid | unavailable`.
- `useCepLookup` — dispara ao completar 8 dígitos com debounce; cache em sessão; estados para UI.
- **Fallback manual sempre disponível**; "não encontrado"/"API indisponível" não bloqueiam o envio.
- `número` e `complemento` **nunca** são sobrescritos pelo retorno do CEP.
- `normalizeCepDigits` preserva zeros à esquerda (capa `01001-000`).

## 13. Contract DRAFT

State machine preservada: `DRAFT → PENDING_SIGNATURE → SIGNED`. O DRAFT permite troca de contratante/notas (`update_contract_draft`) e os snapshots são refrescados. Dados ficam congelados no `issue`. A completude é informativa — **não** bloqueia a criação do rascunho.

## 14. Issue (Emissão)

`issue_contract` marca `PENDING_SIGNATURE` e congela os dados do contrato. Sem alteração nesta auditoria.

## 15. Signature (Assinatura)

`mark_contract_signed` → `SIGNED`. Sem alteração nesta auditoria.

## 16. Cancellation (Cancelamento)

`cancel_contract` registra `CANCELLATION_REASON` no domínio e o evento de auditoria sem PII no `metadata` (padrão existente). Sem alteração nesta auditoria.

---

## 17. PII / LGPD

- Mascaramento é **decisão do banco**: `get_contractor_detail` aplica `mask_cpf/mask_email/mask_phone` e anula RG/endereço quando o usuário não tem `contracts.view_sensitive` (`sensitive` no JSON).
- `update_person` grava auditoria com **apenas nomes de campos** no metadata — nunca valores.
- O frontend nunca consulta `people` diretamente (RPC-only).

## 18. RBAC

| RPC | Requisito de execução | Gate sensível |
| --- | --- | --- |
| `get_contractor_detail` | `contracts.create` **ou** `contracts.edit_draft` | `contracts.view_sensitive` |
| `update_person` | `people.edit` | `contracts.view_sensitive` **or** `students.view_sensitive` |

- Nenhuma permissão nova criada/concedida nesta migration.
- UI: botão de cadastro exige `contracts.create AND people.create`; formulário de completude exige `people.edit` (ADMIN, DIRECAO, PEDAGOGICO, RECEPCAO); sugestão de responsáveis exige `guardians.view`.

## 19. Ownership

RPCs `SECURITY DEFINER` com `search_path` fixo, `row_security = off` apenas dentro da função, `auth.uid()` obrigatório e `grant execute ... to authenticated` (revogado de `public`/`anon`). `updated_by = auth.uid()`.

## 20. Concorrência

`contracts.sale_id` é **UNIQUE**: dois `create_contract_from_sale` simultâneos para a mesma venda → exatamente 1 contrato; o segundo falha (a ser validado por teste de concorrência manual no DEV).

---

## 21. Correções Implementadas

1. `get_contractor_detail` (mascaramento PII no banco).
2. `update_person` (atualização parcial, sem CPF, gate sensível).
3. Pré-seleção do aluno no wizard; ficha carregada; contato/endereço na revisão.
4. `ContractorSearch` com sugestão de responsáveis, estado de troca e fix `canCreate`.
5. `CompleteContractorForm` — só campos faltantes + CEP.
6. CEP lookup no cadastro de pessoa e na completude.
7. Fix de normalização de CEP com zero à esquerda.
8. `database.types.ts` atualizado (regeneração via `supabase gen types` pendente).

## 22. Arquivos Alterados

**Novos**
- `src/services/address/cep-service.ts` (+ `cep-service.test.ts`)
- `src/features/contracts/use-cep-lookup.ts` (+ `.test.tsx`)
- `src/features/contracts/contractor-data.ts` (+ `.test.ts`)
- `src/features/contracts/complete-contractor-form.tsx`
- `supabase/migrations/20260911120000_phase2_4_contracts_audit_fixes.sql`
- `docs/CONTRACTS-AUDIT.md`

**Modificados**
- `src/features/contracts/contract-create-wizard.tsx` (pré-seleção + revisão)
- `src/features/contracts/contractor-search.tsx` (reuso/guardians/fix canCreate)
- `src/features/contracts/edit-contract-dialog.tsx` (fix canCreate + detail)
- `src/features/contracts/create-person-modal.tsx` (CEP + reset)
- `src/features/contracts/contracts-hooks.ts`, `contracts-service.ts`, `contracts-types.ts`
- `src/features/contracts/contracts-service.test.ts`
- `src/types/database.types.ts`

## 23. Migrations

| Migration | Conteúdo | Nome |
| --- | --- | --- |
| `20260911120000_phase2_4_contracts_audit_fixes.sql` | `get_contractor_detail`, `update_person` | `phase2_4_contracts_audit_fixes` |

Aplicada no Supabase DEV via `supabase db push`; `supabase migration list` confirma `local = remote`.

## 24. Tests

- Suite: **288 testes passando (21 novos)** .
- Novos: `cep-service` (+1, zeros à esquerda), `contractor-data` (9), `use-cep-lookup` (7), `contracts-service` (+5 para `getContractorDetail`/`updatePerson`).
- Cobertos: normalização/masked CEP, inválido, not_found, unavailable, debounce, cache/refire, completude (essenciais, contato único, complemento opcional, CPF separado), RPC args/normalização/`''`→undefined.

## 25. Manual QA (Supabase DEV)

Não executado neste ciclo (sem navegador): recomendado o checklist da seção 30 (homologação) antes do merge.

## 26. Quality Gates

| Gate | Resultado |
| --- | --- |
| `npm run typecheck` | OK |
| `npm run lint` (0 warnings) | OK |
| `npm run test` | 288 passed / 0 failed |
| `npm run build` | OK (avisos pré-existentes de chunk > 500 kB, não bloqueadores) |

## 27. Supabase DEV

- Migration `20260911120000` aplicada; lista `local = remote`.
- Regeneração oficial de `database.types.ts` via `supabase gen types typescript` recomendada (entradas adicionadas manualmente nesta auditoria).

## 28. PR #14

Trabalho realizado na branch `feature/contracts-phase-2-4` (mesmo PR). **Não mergear** até homologação.

## 29. Pendências

1. QA manual do wizard em navegador (DEV) — pré-seleção, troca, completude, CEP.
2. Teste de concorrência real (`create_contract_from_sale` duplicado).
3. `get_contractor_detail`/`update_person` — smoke via SQL no DEV já validados na aplicação da migration (sem erro).
4. Decisão de produto: conceder `people.edit` a GERENTE_COMERCIAL/VENDEDOR para permitir completar contratante no fluxo? (por padrão esta auditoria **não** concedeu).
5. Regenerar `database.types.ts`.

## 30. Recomendação Final

**Status**: `FASE 2.4 CONTRACTS — AUDITORIA E2E CONCLUÍDA, AGUARDANDO HOMOLOGAÇÃO`

Roteiro de homologação (checklist):
- [ ] `npm run dev` + fluxo: Venda → Gerar contrato → aluno pré-selecionado → ficha carregada
- [ ] Badge de completude; completar campos faltantes no DEV (RECEPCAO)
- [ ] CEP automático (ex.: `01001-000`) e fallback manual
- [ ] Trocar contratante → responsável sugerido em 1 clique
- [ ] Revisão com contato/endereço → criar DRAFT → emitir → assinar
- [ ] Confirmar que VENDEDOR não vê "Cadastrar novo contratante" (sem `people.create`)
- [ ] `supabase gen types` e novo `npm run test/build`