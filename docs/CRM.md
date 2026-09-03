# CRM Comercial — Profissionaliza Gestão

## Visão Geral

O módulo CRM gerencia o ciclo de vida comercial desde a prospecção até a negociação.
Na Fase 2.2, o foco é: **Lead → Pipeline → Atividades → Negociação**.
A conversão para **Venda/Contrato/Matrícula** será implementada na Fase 2.3.

## Arquitetura

### Identidade Central

- `people` = identidade da pessoa (tabela existente, protegida)
- `crm_leads` = interesse/caso comercial (uma pessoa pode ter N leads)
- `courses` = catálogo de cursos (entidade canônica compartilhada com Pedagógico futuro)

### Pipeline

```
PROSPECÇÃO → NOVO LEAD → CONTATO INICIADO → QUALIFICADO → EM ATENDIMENTO → PROPOSTA ENVIADA → NEGOCIAÇÃO
```

- Movimentação flexível (avanço, retorno, salto)
- Validações por etapa (ex: QUALIFIED exige curso de interesse)
- Histórico completo de movimentações

### Status

| Status | Descrição |
|--------|-----------|
| `OPEN` | Lead ativo no pipeline |
| `LOST` | Lead perdido (com motivo) |
| `WON` | Reservado para Fase 2.3 |
| `ARCHIVED` | Arquivado administrativamente |

### Atividades

Tipos: `CALL`, `WHATSAPP`, `EMAIL`, `MEETING`, `FOLLOW_UP`, `OTHER`

- Próxima atividade = primeira `PENDING` com `due_at >= now()`
- Atividade atrasada = `PENDING` com `due_at < now()`
- Ao perder lead: atividades PENDING futuras são canceladas automaticamente

## Segurança

### Permissões CRM

| Permissão | Descrição |
|-----------|-----------|
| `crm.view` | Acessar módulo CRM |
| `crm.view_all` | Ver leads de toda a equipe |
| `crm.create` | Criar leads |
| `crm.edit` | Editar leads |
| `crm.assign` | Reatribuir leads |
| `crm.move_stage` | Mover leads no pipeline |
| `crm.close_lost` | Fechar lead como perdido |
| `crm.activities.manage` | Gerenciar atividades próprias |
| `crm.activities.manage_all` | Gerenciar atividades da equipe |
| `crm.manage_catalog` | Gerenciar catálogo de cursos |
| `crm.reports` | Relatórios CRM |
| `courses.view` | Visualizar cursos |
| `courses.manage` | Gerenciar cursos |

### Matriz de Acesso

| Role | Permissões |
|------|-----------|
| ADMIN | Todas |
| DIRECAO | Todas CRM + cursos |
| GERENTE_COMERCIAL | CRM completo + view_all + assign + reports + catálogo |
| VENDEDOR | view + create + edit + move_stage + activities.manage |
| RECEPCAO | view + create |
| PEDAGOGICO | courses.view |
| FINANCEIRO | Nenhuma CRM |
| PROFESSOR | Nenhuma |

### Ownership

- Vendedor: só vê/edita seus próprios leads
- Gerente/Direção: vêem todos os leads (crm.view_all)
- RPCs validam ownership internamente

### PII

- Vendedor com acesso ao lead visualiza: nome, telefone, whatsapp, email
- Dados não expostos: CPF, RG, endereço (irrelevante na fase comercial)

## RPCs

| Função | Propósito |
|--------|-----------|
| `create_crm_lead(...)` | Criar lead + pessoa + histórico + auditoria |
| `update_crm_lead(...)` | Atualizar dados do lead |
| `get_crm_lead_detail(...)` | Detalhe 360 do lead |
| `list_crm_pipeline(...)` | Dados do Kanban (limite por coluna) |
| `search_crm_leads(...)` | Lista paginada com filtros |
| `move_crm_lead_stage(...)` | Mover etapa atomicamente |
| `assign_crm_lead(...)` | Reatribuir lead |
| `close_crm_lead_lost(...)` | Fechar como perdido + cancelar atividades |
| `create_crm_activity(...)` | Criar atividade |
| `complete_crm_activity(...)` | Concluir atividade |
| `reschedule_crm_activity(...)` | Reagendar atividade |
| `crm_dashboard_kpis(...)` | KPIs reais do CRM |
| `crm_activity_agenda(...)` | Agenda de atividades |
| `list_courses(...)` | Catálogo de cursos |
| `create_course(...)` | Criar curso |
| `update_course(...)` | Atualizar curso |

## Telas

| Rota | Tela |
|------|------|
| `/crm` | Pipeline Kanban + KPIs + tabs |
| `/crm/leads` | Lista de leads com filtros |
| `/crm/leads/novo` | Formulário novo lead (Drawer) |
| `/crm/leads/:id` | Lead 360 |
| `/crm/atividades` | Agenda de atividades |
| `/crm/cursos` | Catálogo de cursos |

## Fluxo Principal

```
1. Receber lead (Instagram/WhatsApp/Site/Presencial)
2. Criar lead → NEW_LEAD
3. Agendar primeira atividade (Ligação/WhatsApp)
4. Contatar → CONTACT_STARTED
5. Qualificar → QUALIFIED (exige curso + contato + owner)
6. Atender → IN_SERVICE
7. Enviar proposta → PROPOSAL_SENT (exige proposed_value + proposal_sent_at)
8. Negociar → NEGOTIATION
9. Fechar venda (Fase 2.3) ou marcar perdido
```

## Campo Comercial

| Campo | Uso |
|-------|-----|
| `estimated_value` | Valor estimado da oportunidade |
| `proposed_value` | Valor proposto ao cliente |
| `proposal_sent_at` | Data de envio da proposta |
| `commercial_notes` | Observações comerciais |

Esses campos são referência comercial. Não representam venda/contrato/financeiro.
