import { describe, it, expect } from 'vitest'
import { computeTotalPages, clampPage } from './pagination'

describe('computeTotalPages', () => {
  it('retorna pelo menos 1 mesmo sem resultados', () => {
    expect(computeTotalPages(0, 20)).toBe(1)
    expect(computeTotalPages(0, 25)).toBe(1)
  })

  it('arredonda para cima considerando o page_size', () => {
    expect(computeTotalPages(20, 20)).toBe(1)
    expect(computeTotalPages(21, 20)).toBe(2)
    expect(computeTotalPages(40, 20)).toBe(2)
    expect(computeTotalPages(41, 20)).toBe(3)
    expect(computeTotalPages(43, 20)).toBe(3)
  })
})

describe('clampPage', () => {
  it('mantém páginas já dentro do intervalo', () => {
    expect(clampPage(1, 3)).toBe(1)
    expect(clampPage(2, 3)).toBe(2)
    expect(clampPage(3, 3)).toBe(3)
  })

  it('limita a página solicitada à última página válida', () => {
    expect(clampPage(999, 3)).toBe(3)
    expect(clampPage(5, 1)).toBe(1)
  })

  it('nunca retorna abaixo de 1', () => {
    expect(clampPage(0, 3)).toBe(1)
    expect(clampPage(-5, 3)).toBe(1)
    expect(clampPage(2, 0)).toBe(1)
  })
})