import type { CrmLeadStatus, CrmTemperature, CrmActivityType, CrmPipelineStage, CrmLeadSource, CrmLostReason } from './crm-types'

export const CRM_LEAD_STATUSES: readonly CrmLeadStatus[] = ['OPEN', 'LOST', 'WON', 'ARCHIVED'] as const

export const CRM_STATUS_LABELS: Record<CrmLeadStatus, string> = {
  OPEN: 'Aberto',
  LOST: 'Perdido',
  WON: 'Ganho',
  ARCHIVED: 'Arquivado'
}

export const CRM_STATUS_TONES: Record<CrmLeadStatus, 'neutral' | 'success' | 'danger' | 'info'> = {
  OPEN: 'neutral',
  LOST: 'danger',
  WON: 'success',
  ARCHIVED: 'info'
}

export const CRM_TEMPERATURES: readonly CrmTemperature[] = ['HOT', 'WARM', 'COLD'] as const

export const CRM_TEMPERATURE_LABELS: Record<CrmTemperature, string> = {
  HOT: 'Quente',
  WARM: 'Morno',
  COLD: 'Frio'
}

export const CRM_TEMPERATURE_TONES: Record<CrmTemperature, 'danger' | 'warning' | 'info'> = {
  HOT: 'danger',
  WARM: 'warning',
  COLD: 'info'
}

export const CRM_ACTIVITY_TYPES: readonly CrmActivityType[] = ['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'OTHER'] as const

export const CRM_ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  CALL: 'Ligação',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  MEETING: 'Reunião',
  FOLLOW_UP: 'Follow-up',
  OTHER: 'Outro'
}

export const CRM_PIPELINE_STAGES: CrmPipelineStage[] = [
  { id: '', code: 'PROSPECTING', name: 'Prospecção', position: 10, probability: 5, is_active: true },
  { id: '', code: 'NEW_LEAD', name: 'Novo Lead', position: 20, probability: 10, is_active: true },
  { id: '', code: 'CONTACT_STARTED', name: 'Contato Iniciado', position: 30, probability: 25, is_active: true },
  { id: '', code: 'QUALIFIED', name: 'Qualificado', position: 40, probability: 50, is_active: true },
  { id: '', code: 'IN_SERVICE', name: 'Em Atendimento', position: 50, probability: 65, is_active: true },
  { id: '', code: 'PROPOSAL_SENT', name: 'Proposta Enviada', position: 60, probability: 80, is_active: true },
  { id: '', code: 'NEGOTIATION', name: 'Negociação', position: 70, probability: 90, is_active: true }
]

export const CRM_PIPELINE_STAGE_CODES = CRM_PIPELINE_STAGES.map((s) => s.code)

export const CRM_PIPELINE_STAGE_LABELS: Record<string, string> = Object.fromEntries(
  CRM_PIPELINE_STAGES.map((s) => [s.code, s.name])
)

export const CRM_LEAD_SOURCES: CrmLeadSource[] = [
  { id: '', code: 'WHATSAPP', name: 'WhatsApp', is_active: true },
  { id: '', code: 'INSTAGRAM', name: 'Instagram', is_active: true },
  { id: '', code: 'SITE', name: 'Site', is_active: true },
  { id: '', code: 'PRESENCIAL', name: 'Presencial', is_active: true },
  { id: '', code: 'INDICACAO', name: 'Indicação', is_active: true },
  { id: '', code: 'LIGACAO', name: 'Ligação', is_active: true },
  { id: '', code: 'CAMPANHA', name: 'Campanha', is_active: true },
  { id: '', code: 'PARCEIRO', name: 'Parceiro', is_active: true },
  { id: '', code: 'PROSPECCAO', name: 'Prospecção', is_active: true },
  { id: '', code: 'OUTRO', name: 'Outro', is_active: true }
]

export const CRM_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  CRM_LEAD_SOURCES.map((s) => [s.code, s.name])
)

export const CRM_LOST_REASONS: CrmLostReason[] = [
  { id: '', code: 'PRICE', name: 'Preço', is_active: true },
  { id: '', code: 'NO_INTEREST', name: 'Sem interesse', is_active: true },
  { id: '', code: 'COMPETITOR', name: 'Escolheu concorrente', is_active: true },
  { id: '', code: 'NO_RESPONSE', name: 'Sem retorno', is_active: true },
  { id: '', code: 'SCHEDULE', name: 'Horário incompatível', is_active: true },
  { id: '', code: 'COURSE_UNAVAILABLE', name: 'Curso indisponível', is_active: true },
  { id: '', code: 'FINANCIAL_CONDITION', name: 'Condição financeira', is_active: true },
  { id: '', code: 'OTHER', name: 'Outro', is_active: true }
]

export const CRM_LOST_REASON_LABELS: Record<string, string> = Object.fromEntries(
  CRM_LOST_REASONS.map((r) => [r.code, r.name])
)

export const CRM_ENTRY_TYPES = ['PROSPECTING', 'LEAD_RECEIVED'] as const
export type CrmEntryType = (typeof CRM_ENTRY_TYPES)[number]

export const CRM_ENTRY_TYPE_LABELS: Record<CrmEntryType, string> = {
  PROSPECTING: 'Prospecção',
  LEAD_RECEIVED: 'Lead recebido'
}

export const CRM_PREFERRED_SHIFTS = ['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE'] as const
export type CrmPreferredShift = (typeof CRM_PREFERRED_SHIFTS)[number]

export const CRM_SHIFT_LABELS: Record<CrmPreferredShift, string> = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  EVENING: 'Noite',
  FLEXIBLE: 'Flexível'
}
