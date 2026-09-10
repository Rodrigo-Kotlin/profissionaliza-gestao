import { SALE_ELIGIBLE_STAGES } from './sales-constants'
import type { CrmLeadDetail } from '../crm/crm-types'

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
