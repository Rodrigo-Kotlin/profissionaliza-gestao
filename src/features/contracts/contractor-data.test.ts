import { describe, expect, it } from 'vitest'
import { getContractorCompleteness } from './contractor-data'
import type { ContractorDetail } from './contracts-types'

const baseDetail: ContractorDetail = {
  person_id: 'person-1',
  full_name: 'Maria Silva',
  preferred_name: null,
  birth_date: '2000-01-01',
  cpf: '123.456.789-00',
  rg: null,
  email: 'maria@exemplo.com',
  phone: '11999990000',
  whatsapp: null,
  postal_code: '68000000',
  street: 'Rua das Flores',
  number: '10',
  complement: null,
  district: 'Centro',
  city: 'Santarém',
  state: 'PA',
  sensitive: true
}

describe('getContractorCompleteness', () => {
  it('marks a fully populated contractor as complete', () => {
    const result = getContractorCompleteness(baseDetail)
    expect(result.isComplete).toBe(true)
    expect(result.cpfMissing).toBe(false)
    expect(result.missing).toEqual([])
  })

  it('flags missing CEP when only the CEP is absent', () => {
    const result = getContractorCompleteness({ ...baseDetail, postal_code: null })
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('postal_code')
  })

  it('requires the full address block (street, number, district, city, state)', () => {
    const result = getContractorCompleteness({ ...baseDetail, street: null, city: null, state: null })
    expect(result.missing).toEqual(expect.arrayContaining(['street', 'city', 'state']))
    expect(result.missing).not.toContain('complement')
  })

  it('considers complement optional (manual field)', () => {
    const result = getContractorCompleteness({ ...baseDetail, complement: null })
    expect(result.isComplete).toBe(true)
  })

  it('considers preferred_name optional', () => {
    const result = getContractorCompleteness({ ...baseDetail, preferred_name: null })
    expect(result.isComplete).toBe(true)
  })

  it('requires at least one contact (phone OR whatsapp OR email)', () => {
    const result = getContractorCompleteness({ ...baseDetail, phone: null, whatsapp: null, email: null })
    expect(result.isComplete).toBe(false)
    expect(result.missing).toEqual(expect.arrayContaining(['phone', 'whatsapp', 'email']))
  })

  it('accepts any single contact as sufficient', () => {
    const onlyEmail = getContractorCompleteness({ ...baseDetail, phone: null, whatsapp: null })
    const onlyPhone = getContractorCompleteness({ ...baseDetail, email: null, whatsapp: null })
    expect(onlyEmail.isComplete).toBe(true)
    expect(onlyPhone.isComplete).toBe(true)
  })

  it('tracks missing CPF separately (informational, not completable via update_person)', () => {
    const result = getContractorCompleteness({ ...baseDetail, cpf: null })
    expect(result.cpfMissing).toBe(true)
    expect(result.missing).not.toContain('cpf')
  })

  it('reports full_name as missing when blank', () => {
    const result = getContractorCompleteness({ ...baseDetail, full_name: '' })
    expect(result.isComplete).toBe(false)
    expect(result.missing).toContain('full_name')
  })
})