import { describe, it, expect } from 'vitest'
import { closeSaleSchema, cancelSaleSchema } from './sales-schemas'

describe('closeSaleSchema', () => {
  it('accepts valid input', () => {
    const result = closeSaleSchema.safeParse({
      course_id: 'course-1',
      gross_value: 1500,
      discount_value: 0,
      payment_method: 'PIX',
      installments: 1
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty course_id', () => {
    const result = closeSaleSchema.safeParse({
      course_id: '',
      gross_value: 1500,
      discount_value: 0,
      payment_method: 'PIX',
      installments: 1
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero gross_value', () => {
    const result = closeSaleSchema.safeParse({
      course_id: 'course-1',
      gross_value: 0,
      discount_value: 0,
      payment_method: 'PIX',
      installments: 1
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative discount', () => {
    const result = closeSaleSchema.safeParse({
      course_id: 'course-1',
      gross_value: 1500,
      discount_value: -1,
      payment_method: 'PIX',
      installments: 1
    })
    expect(result.success).toBe(false)
  })

  it('rejects installments < 1', () => {
    const result = closeSaleSchema.safeParse({
      course_id: 'course-1',
      gross_value: 1500,
      discount_value: 0,
      payment_method: 'PIX',
      installments: 0
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid payment_method', () => {
    const result = closeSaleSchema.safeParse({
      course_id: 'course-1',
      gross_value: 1500,
      discount_value: 0,
      payment_method: 'INVALID',
      installments: 1
    })
    expect(result.success).toBe(false)
  })

  it('defaults discount_value to 0', () => {
    const result = closeSaleSchema.safeParse({
      course_id: 'course-1',
      gross_value: 1500,
      payment_method: 'PIX',
      installments: 1
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.discount_value).toBe(0)
  })
})

describe('cancelSaleSchema', () => {
  it('accepts valid reason', () => {
    const result = cancelSaleSchema.safeParse({ cancellation_reason: 'Cliente desistiu do curso' })
    expect(result.success).toBe(true)
  })

  it('rejects empty reason', () => {
    const result = cancelSaleSchema.safeParse({ cancellation_reason: '' })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only reason', () => {
    const result = cancelSaleSchema.safeParse({ cancellation_reason: '   ' })
    expect(result.success).toBe(false)
  })

  it('rejects reason > 2000 chars', () => {
    const result = cancelSaleSchema.safeParse({ cancellation_reason: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('accepts reason at exactly 2000 chars', () => {
    const result = cancelSaleSchema.safeParse({ cancellation_reason: 'a'.repeat(2000) })
    expect(result.success).toBe(true)
  })
})
