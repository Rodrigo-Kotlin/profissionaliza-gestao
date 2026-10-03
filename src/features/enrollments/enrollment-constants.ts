import type { EnrollmentStatus } from './enrollment-types'

export const ENROLLMENT_STATUSES: readonly EnrollmentStatus[] = ['PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELED']

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Ativa',
  PAUSED: 'Pausada',
  COMPLETED: 'Concluída',
  CANCELED: 'Cancelada'
}

export const ENROLLMENT_STATUS_TONES: Record<EnrollmentStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  PAUSED: 'info',
  COMPLETED: 'neutral',
  CANCELED: 'danger'
}

export const ENROLLMENT_PAGE_SIZE = 20
