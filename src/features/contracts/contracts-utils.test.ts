import { describe, it, expect } from 'vitest'
import {
  canCreateContractFromSale,
  generateContractCode,
  formatContractAddress,
  getNextContractStatus,
  describeContractAction,
  isEditDraftAllowed,
  isIssueAllowed,
  isSignAllowed,
  isCancelAllowed
} from './contracts-utils'

const sale = { status: 'CONFIRMED', seller_user_id: 'user-1', contract_id: null }

describe('generateContractCode', () => {
  it('gera CTR-YYYY-NNNNNN', () => {
    expect(generateContractCode(2026, 1)).toBe('CTR-2026-000001')
    expect(generateContractCode(2026, 42)).toBe('CTR-2026-000042')
    expect(generateContractCode(2026, 123456)).toBe('CTR-2026-123456')
  })
})

describe('canCreateContractFromSale', () => {
  const owner = ['contracts.create', 'sales.view'] as const
  const manager = ['contracts.create', 'contracts.view_all'] as const
  const noCreate = ['sales.view'] as const

  it('permite ao vendedor dono da venda com contracts.create', () => {
    expect(canCreateContractFromSale(sale, owner, 'user-1')).toBe(true)
  })

  it('permite a papel global (view_all) com contracts.create', () => {
    expect(canCreateContractFromSale(sale, manager, 'user-2')).toBe(true)
  })

  it('bloqueia venda não confirmada', () => {
    expect(canCreateContractFromSale({ ...sale, status: 'CANCELED' }, owner, 'user-1')).toBe(false)
  })

  it('bloqueia quando já existe contrato', () => {
    expect(canCreateContractFromSale({ ...sale, contract_id: 'ct-1' }, owner, 'user-1')).toBe(false)
  })

  it('bloqueia sem contracts.create', () => {
    expect(canCreateContractFromSale(sale, noCreate, 'user-1')).toBe(false)
  })

  it('bloqueia não-dono sem view_all', () => {
    expect(canCreateContractFromSale(sale, owner, 'user-2')).toBe(false)
  })
})

describe('transições de estado', () => {
  it('mapeia ações por estado', () => {
    expect(isEditDraftAllowed('DRAFT')).toBe(true)
    expect(isEditDraftAllowed('PENDING_SIGNATURE')).toBe(false)
    expect(isIssueAllowed('DRAFT')).toBe(true)
    expect(isIssueAllowed('PENDING_SIGNATURE')).toBe(false)
    expect(isSignAllowed('PENDING_SIGNATURE')).toBe(true)
    expect(isSignAllowed('SIGNED')).toBe(false)
    expect(isCancelAllowed('DRAFT')).toBe(true)
    expect(isCancelAllowed('PENDING_SIGNATURE')).toBe(true)
    expect(isCancelAllowed('SIGNED')).toBe(false)
    expect(isCancelAllowed('CANCELED')).toBe(false)
  })

  it('próximo estado válido', () => {
    expect(getNextContractStatus('DRAFT')).toBe('PENDING_SIGNATURE')
    expect(getNextContractStatus('PENDING_SIGNATURE')).toBe('SIGNED')
    expect(getNextContractStatus('SIGNED')).toBeNull()
    expect(getNextContractStatus('CANCELED')).toBeNull()
  })

  it('descreve ações por estado', () => {
    expect(describeContractAction('DRAFT')).toContain('Emitir contrato')
    expect(describeContractAction('PENDING_SIGNATURE')).toContain('Registrar assinatura')
    expect(describeContractAction('SIGNED')).toContain('sem ações adicionais')
    expect(describeContractAction('CANCELED')).toContain('cancelado')
  })
})

describe('formatContractAddress', () => {
  it('formata endereço completo', () => {
    expect(formatContractAddress({
      postal_code: '01001-000',
      street: 'Av. Paulista',
      number: '1000',
      complement: 'Sala 5',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil'
    })).toContain('Av. Paulista')
    expect(formatContractAddress({
      postal_code: '01001-000',
      street: 'Av. Paulista',
      number: '1000',
      complement: 'Sala 5',
      district: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      country: 'Brasil'
    })).toContain('CEP 01001-000')
  })

  it('ignora valores vazios', () => {
    const address = { postal_code: null, street: 'Rua A', number: null, complement: null, district: null, city: null, state: null, country: null }
    expect(formatContractAddress(address)).toBe('Rua A')
  })

  it('retorna string vazia sem endereço', () => {
    expect(formatContractAddress(null)).toBe('')
    expect(formatContractAddress(undefined)).toBe('')
  })
})