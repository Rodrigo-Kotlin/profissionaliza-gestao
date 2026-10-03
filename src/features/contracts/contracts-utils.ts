import { can, PERMISSIONS } from '@/lib/rbac'
import {
  CONTRACT_CANCELABLE_STATUSES,
  CONTRACT_EDITABLE_STATUSES,
  CONTRACT_ISSUABLE_STATUSES,
  CONTRACT_SIGNABLE_STATUSES,
  CONTRACT_STATUS_LABELS
} from './contracts-constants'
import type { ContractorAddressSnapshot, ContractStatus } from './contracts-types'

export type ContractListUrlParams = {
  q?: string
  status?: string
  seller?: string
  course?: string
  date_from?: string
  date_to?: string
  page: number
}

export function parseContractListParams(url: URLSearchParams): ContractListUrlParams {
  const rawStatus = url.get('status')?.trim() || ''
  const status = rawStatus && (CONTRACT_STATUS_LABELS as Record<string, string>)[rawStatus] ? rawStatus : undefined
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

export function generateContractCode(year: number, sequence: number): string {
  const seq = String(sequence).padStart(6, '0')
  return `CTR-${year}-${seq}`
}

export function canCreateContractFromSale(
  sale: { status: string; seller_user_id: string; contract_id?: string | null },
  permissions: readonly string[],
  userId: string
): boolean {
  if (sale.status !== 'CONFIRMED') return false
  if (sale.contract_id) return false
  if (!can(permissions, PERMISSIONS.CONTRACTS_CREATE)) return false
  if (sale.seller_user_id === userId) return true
  return can(permissions, PERMISSIONS.CONTRACTS_VIEW_ALL)
}

export const isEditDraftAllowed = (status: ContractStatus): boolean =>
  (CONTRACT_EDITABLE_STATUSES as readonly string[]).includes(status)

export const isIssueAllowed = (status: ContractStatus): boolean =>
  (CONTRACT_ISSUABLE_STATUSES as readonly string[]).includes(status)

export const isSignAllowed = (status: ContractStatus): boolean =>
  (CONTRACT_SIGNABLE_STATUSES as readonly string[]).includes(status)

export const isCancelAllowed = (status: ContractStatus): boolean =>
  (CONTRACT_CANCELABLE_STATUSES as readonly string[]).includes(status)

export function formatContractAddress(address: ContractorAddressSnapshot | null | undefined): string {
  if (!address) return ''
  const streetLine = [address.street, address.number && `nº ${address.number}`].filter(Boolean).join(', ')
  const rest = [address.complement, address.district].filter(Boolean).join(' - ')
  const cityLine = [address.city, address.state && `- ${address.state}`].filter(Boolean).join(' ')
  const zipLine = address.postal_code ? `CEP ${address.postal_code}` : ''
  return [streetLine, rest, cityLine, zipLine].filter(Boolean).join('\n')
}

export function getNextContractStatus(current: ContractStatus): ContractStatus | null {
  if (current === 'DRAFT') return 'PENDING_SIGNATURE'
  if (current === 'PENDING_SIGNATURE') return 'SIGNED'
  return null
}

export function describeContractAction(status: ContractStatus): string {
  if (status === 'DRAFT') return 'Editar rascunho · Emitir contrato · Cancelar'
  if (status === 'PENDING_SIGNATURE') return 'Registrar assinatura · Cancelar'
  if (status === 'SIGNED') return 'Contrato assinado, sem ações adicionais'
  return 'Contrato cancelado, sem ações adicionais'
}
