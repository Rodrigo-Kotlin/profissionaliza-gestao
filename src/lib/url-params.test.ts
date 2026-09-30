import { describe, it, expect } from 'vitest'
import { updateSearchParams } from './url-params'

describe('updateSearchParams (Fase 7)', () => {
  it('mantém params existentes e aplica updates', () => {
    const next = updateSearchParams(new URLSearchParams('?status=CONFIRMED&q=Ana'), { seller: 'u1' })
    expect(next.get('status')).toBe('CONFIRMED')
    expect(next.get('q')).toBe('Ana')
    expect(next.get('seller')).toBe('u1')
  })

  it('alterar filtro reseta (remove) a página', () => {
    const next = updateSearchParams(new URLSearchParams('?page=3&status=SIGNED'), { status: 'DRAFT' })
    expect(next.get('status')).toBe('DRAFT')
    expect(next.has('page')).toBe(false)
  })

  it('limpar filtro também reseta a página', () => {
    const next = updateSearchParams(new URLSearchParams('?page=3&status=SIGNED'), { status: null })
    expect(next.has('status')).toBe(false)
    expect(next.has('page')).toBe(false)
  })

  it('atualização só de página mantém a página setada', () => {
    const next = updateSearchParams(new URLSearchParams('?status=SIGNED'), { page: 4 })
    expect(next.get('page')).toBe('4')
    expect(next.get('status')).toBe('SIGNED')
  })

  it('retornar para a página 1 remove o parâmetro page', () => {
    const next = updateSearchParams(new URLSearchParams('?page=4'), { page: 1 })
    expect(next.has('page')).toBe(false)
  })

  it('valores vazios preservados como string', () => {
    const next = updateSearchParams(new URLSearchParams(), { page: '2' })
    expect(next.get('page')).toBe('2')
  })
})