import { describe, it, expect } from 'vitest'
import { shouldRetry } from './query'

describe('shouldRetry', () => {
  it('não repete erros determinísticos de schema/permissão', () => {
    expect(shouldRetry(0, { code: 'PGRST202' })).toBe(false)
    expect(shouldRetry(0, { code: '42501' })).toBe(false)
    expect(shouldRetry(0, { code: '42883' })).toBe(false)
    expect(shouldRetry(0, { code: 'P0002' })).toBe(false)
  })

  it('não repete quando já houve pelo menos uma tentativa', () => {
    expect(shouldRetry(1, { code: 'PGRST202' })).toBe(false)
    expect(shouldRetry(1, {})).toBe(false)
  })

  it('permite retry para falhas transitórias (ex.: rede)', () => {
    expect(shouldRetry(0, { code: '5XX' })).toBe(true)
    expect(shouldRetry(0, { message: 'network error' })).toBe(true)
  })
})
