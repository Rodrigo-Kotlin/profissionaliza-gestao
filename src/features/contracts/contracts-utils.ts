import { can, PERMISSIONS } from '@/lib/rbac'
import {
  CONTRACT_CANCELABLE_STATUSES,
  CONTRACT_EDITABLE_STATUSES,
  CONTRACT_ISSUABLE_STATUSES,
  CONTRACT_SIGNABLE_STATUSES
} from './contracts-constants'
import type { ContractorAddressSnapshot, ContractStatus } from './contracts-types'

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