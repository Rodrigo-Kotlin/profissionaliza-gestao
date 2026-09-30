import type { ContractStatus, ContractCourseModality } from './contracts-types'

export const CONTRACT_STATUSES = ['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CANCELED'] as const

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: 'Rascunho',
  PENDING_SIGNATURE: 'Aguardando assinatura',
  SIGNED: 'Assinado',
  CANCELED: 'Cancelado'
}

export const CONTRACT_STATUS_TONES: Record<ContractStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  PENDING_SIGNATURE: 'warning',
  SIGNED: 'success',
  CANCELED: 'danger'
}

export const CONTRACT_COURSE_MODALITY_LABELS: Record<ContractCourseModality, string> = {
  PRESENCIAL: 'Presencial',
  ONLINE: 'Online',
  HIBRIDO: 'Híbrido'
}

export const CONTRACT_PAGE_SIZE = 25

export const CONTRACT_EDITABLE_STATUSES: readonly ContractStatus[] = ['DRAFT']
export const CONTRACT_ISSUABLE_STATUSES: readonly ContractStatus[] = ['DRAFT']
export const CONTRACT_SIGNABLE_STATUSES: readonly ContractStatus[] = ['PENDING_SIGNATURE']
export const CONTRACT_CANCELABLE_STATUSES: readonly ContractStatus[] = ['DRAFT', 'PENDING_SIGNATURE']