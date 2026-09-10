import type { SaleStatus, SalePaymentMethod } from './sales-types'

export const SALE_STATUSES = ['CONFIRMED', 'CANCELED'] as const

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  CONFIRMED: 'Confirmada',
  CANCELED: 'Cancelada'
}

export const SALE_STATUS_TONES: Record<SaleStatus, 'success' | 'danger'> = {
  CONFIRMED: 'success',
  CANCELED: 'danger'
}

export const SALE_PAYMENT_METHODS: readonly SalePaymentMethod[] = [
  'PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'TRANSFERENCIA', 'OUTRO'
] as const

export const SALE_PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  PIX: 'PIX',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
  OUTRO: 'Outro'
}

export const SALE_ELIGIBLE_STAGES = ['PROPOSAL_SENT', 'NEGOTIATION'] as const

export const SALE_PAGE_SIZE = 25
