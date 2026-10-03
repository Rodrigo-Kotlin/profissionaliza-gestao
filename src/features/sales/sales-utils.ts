import { SALE_ELIGIBLE_STAGES, SALE_STATUS_LABELS } from './sales-constants'
import type { CrmLeadDetail } from '../crm/crm-types'

export type SaleListUrlParams = {
  q?: string
  status?: string
  seller?: string
  course?: string
  date_from?: string
  date_to?: string
  page: number
}

export function parseSaleListParams(url: URLSearchParams): SaleListUrlParams {
  const rawStatus = url.get('status')?.trim() || ''
  const status = rawStatus && (SALE_STATUS_LABELS as Record<string, string>)[rawStatus] ? rawStatus : undefined
  return {
    q: url.get('q') || undefined,
    status,
    seller: url.get('seller')?.trim() || undefined,
    course: url.get('course')?.trim() || undefined,
    date_from: url.get('date_from')?.trim() || undefined,
    date_to: url.get('date_to')?.trim() || undefined,
    page: Math.max(1, Number(url.get('page')) || 1)
  }
}

export function generateSaleCode(year: number, sequence: number): string {
  const seq = String(sequence).padStart(6, '0')
  return `VND-${year}-${seq}`
}

export function formatSaleCode(code: string): string {
  return code
}

export function canCloseSale(lead: CrmLeadDetail, permissions: readonly string[], userId: string): boolean {
  if (lead.status !== 'OPEN') return false
  if (!SALE_ELIGIBLE_STAGES.includes(lead.stage_code as typeof SALE_ELIGIBLE_STAGES[number])) return false
  if (!permissions.includes('sales.create')) return false
  if (lead.owner_user_id === userId) return true
  if (permissions.includes('crm.view_all')) return true
  return false
}

export function isSaleEligibleStage(stageCode: string): boolean {
  return SALE_ELIGIBLE_STAGES.includes(stageCode as typeof SALE_ELIGIBLE_STAGES[number])
}
