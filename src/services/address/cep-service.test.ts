import { describe, expect, it, vi } from 'vitest'
import { lookupCep, normalizeCepDigits, type CepProvider } from './cep-service'

const okProvider = (address: Parameters<CepProvider>[0] extends never ? never : unknown): CepProvider => {
  const base = { postal_code: '68000000', street: 'Rua X', district: 'Centro', city: 'Santarém', state: 'PA' }
  const merged = { ...base, ...(address as object) }
  return vi.fn(async () => merged) as unknown as CepProvider
}

describe('lookupCep', () => {
  it('normalizes masked CEP before lookup', async () => {
    const provider = okProvider({})
    const result = await lookupCep({ cep: '68000-000', provider })
    expect(provider).toHaveBeenCalledWith('68000000', undefined)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.address.postal_code).toBe('68000000')
  })

  it('preserves leading zeros (e.g. São Paulo 01001-000)', async () => {
    const provider = okProvider({})
    await lookupCep({ cep: '01001-000', provider })
    expect(provider).toHaveBeenCalledWith('01001000', undefined)
    expect(normalizeCepDigits('01001-000')).toBe('01001000')
  })

  it('returns invalid when fewer than 8 digits', async () => {
    const provider = vi.fn() as unknown as CepProvider
    const result = await lookupCep({ cep: '6800', provider })
    expect(provider).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: false, error: 'invalid' })
  })

  it('returns address on successful lookup', async () => {
    const result = await lookupCep({ cep: '68000000', provider: okProvider({ street: 'Av Central' }) })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.address.street).toBe('Av Central')
      expect(result.address.state).toBe('PA')
    }
  })

  it('allows manual fallback when CEP not found', async () => {
    const provider = vi.fn(async () => null) as unknown as CepProvider
    const result = await lookupCep({ cep: '68000000', provider })
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })

  it('allows manual fallback when API is unavailable', async () => {
    const provider = vi.fn(async () => {
      throw new Error('network down')
    }) as unknown as CepProvider
    const result = await lookupCep({ cep: '68000000', provider })
    expect(result).toEqual({ ok: false, error: 'unavailable' })
  })

  it('never overwrites number field (number is not part of the result)', async () => {
    const result = await lookupCep({ cep: '68000000', provider: okProvider({}) })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('number' in result.address).toBe(false)
    }
  })

  it('never overwrites complement without confirmation (not part of the result)', async () => {
    const result = await lookupCep({ cep: '68000000', provider: okProvider({}) })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect('complement' in result.address).toBe(false)
    }
  })
})