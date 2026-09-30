import { describe, it, expect } from 'vitest'
import {
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  CONTRACT_EDITABLE_STATUSES,
  CONTRACT_ISSUABLE_STATUSES,
  CONTRACT_SIGNABLE_STATUSES,
  CONTRACT_CANCELABLE_STATUSES
} from './contracts-constants'

describe('CONTRACT_STATUSES', () => {
  it('contém exatamente os 4 estados da máquina', () => {
    expect(CONTRACT_STATUSES).toEqual(['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CANCELED'])
  })
})

describe('CONTRACT_STATUS_LABELS', () => {
  it('rotula todos os estados sem duplicatas', () => {
    const values = Object.values(CONTRACT_STATUS_LABELS)
    expect(new Set(values).size).toBe(values.length)
    CONTRACT_STATUSES.forEach((status) => {
      expect(CONTRACT_STATUS_LABELS[status]).toBeTruthy()
    })
  })
})

describe('CONTRACT_STATUS_TONES', () => {
  it('mapeia tone por estado', () => {
    expect(CONTRACT_STATUS_TONES.DRAFT).toBe('neutral')
    expect(CONTRACT_STATUS_TONES.PENDING_SIGNATURE).toBe('warning')
    expect(CONTRACT_STATUS_TONES.SIGNED).toBe('success')
    expect(CONTRACT_STATUS_TONES.CANCELED).toBe('danger')
  })
})

describe('transições de status', () => {
  it('DRAFT é editável e emitível', () => {
    expect(CONTRACT_EDITABLE_STATUSES).toContain('DRAFT')
    expect(CONTRACT_ISSUABLE_STATUSES).toContain('DRAFT')
  })

  it('PENDING_SIGNATURE é assinável', () => {
    expect(CONTRACT_SIGNABLE_STATUSES).toContain('PENDING_SIGNATURE')
  })

  it('DRAFT e PENDING_SIGNATURE são canceláveis, SIGNED e CANCELED não', () => {
    expect(CONTRACT_CANCELABLE_STATUSES).toContain('DRAFT')
    expect(CONTRACT_CANCELABLE_STATUSES).toContain('PENDING_SIGNATURE')
    expect(CONTRACT_CANCELABLE_STATUSES).not.toContain('SIGNED')
    expect(CONTRACT_CANCELABLE_STATUSES).not.toContain('CANCELED')
  })

  it('nunca permite editar/emitir/assinar fora dos estados corretos', () => {
    expect(CONTRACT_EDITABLE_STATUSES).not.toContain('PENDING_SIGNATURE')
    expect(CONTRACT_EDITABLE_STATUSES).not.toContain('SIGNED')
    expect(CONTRACT_ISSUABLE_STATUSES).not.toContain('PENDING_SIGNATURE')
    expect(CONTRACT_SIGNABLE_STATUSES).not.toContain('DRAFT')
    expect(CONTRACT_SIGNABLE_STATUSES).not.toContain('SIGNED')
  })
})