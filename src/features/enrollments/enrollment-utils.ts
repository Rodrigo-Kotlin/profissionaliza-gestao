import { ENROLLMENT_STATUS_LABELS } from './enrollment-constants'
import type { EnrollmentListParams } from './enrollment-types'

export type EnrollmentUrlParams = EnrollmentListParams & { page: number }

export function parseEnrollmentListParams(url: URLSearchParams): EnrollmentUrlParams {
  const status = url.get('status')?.trim() || undefined
  return {
    q: url.get('q')?.trim() || undefined,
    status: status && ENROLLMENT_STATUS_LABELS[status as keyof typeof ENROLLMENT_STATUS_LABELS] ? status : undefined,
    course_id: url.get('course')?.trim() || undefined,
    date_from: url.get('date_from')?.trim() || undefined,
    date_to: url.get('date_to')?.trim() || undefined,
    page: Math.max(1, Number(url.get('page')) || 1)
  }
}

export function formatEnrollmentDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR')
}

export function formatEnrollmentDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : 'Não informado'
}
