import { describe, it, expect } from 'vitest'
import {
  parseCrmLeadListParams,
  updateSearchParams,
  formatCurrency,
  normalizePhone,
  normalizeEmail,
  getDaysInStage,
  isOverdue,
  formatRelativeDate,
  formatDueAt,
  stageMoveErrorMessage
} from './crm-utils'

describe('parseCrmLeadListParams', () => {
  it('returns defaults for empty params', () => {
    const params = parseCrmLeadListParams(new URLSearchParams())
    expect(params.status).toBe('OPEN')
    expect(params.page).toBe(1)
    expect(params.page_size).toBe(25)
    expect(params.sort).toBe('created_at')
    expect(params.dir).toBe('DESC')
  })

  it('parses query params correctly', () => {
    const sp = new URLSearchParams({ q: 'maria', stage: 'QUALIFIED', temp: 'HOT', page: '2' })
    const params = parseCrmLeadListParams(sp)
    expect(params.q).toBe('maria')
    expect(params.stage_code).toBe('QUALIFIED')
    expect(params.temperature).toBe('HOT')
    expect(params.page).toBe(2)
  })

  it('parses boolean flags', () => {
    const sp = new URLSearchParams({ overdue: '1', no_activity: '1' })
    const params = parseCrmLeadListParams(sp)
    expect(params.overdue_only).toBe(true)
    expect(params.no_activity).toBe(true)
  })
})

describe('updateSearchParams', () => {
  it('sets new values', () => {
    const current = new URLSearchParams()
    const next = updateSearchParams(current, { q: 'test', stage: 'QUALIFIED' })
    expect(next.get('q')).toBe('test')
    expect(next.get('stage')).toBe('QUALIFIED')
  })

  it('removes values when set to null/undefined/empty', () => {
    const current = new URLSearchParams({ q: 'test', stage: 'QUALIFIED' })
    const next = updateSearchParams(current, { q: null, stage: undefined })
    expect(next.has('q')).toBe(false)
    expect(next.has('stage')).toBe(false)
  })

  it('resets page when filters change', () => {
    const current = new URLSearchParams({ page: '5', q: 'old' })
    const next = updateSearchParams(current, { q: 'new' })
    expect(next.get('page')).toBe('1')
  })

  it('keeps page when only page changes', () => {
    const current = new URLSearchParams({ page: '3' })
    const next = updateSearchParams(current, { page: '7' })
    expect(next.get('page')).toBe('7')
  })
})

describe('formatCurrency', () => {
  it('formats BRL currency', () => {
    expect(formatCurrency(1500)).toContain('1.500')
    expect(formatCurrency(0)).toContain('0')
  })

  it('returns — for null', () => {
    expect(formatCurrency(null)).toBe('—')
  })
})

describe('normalizePhone', () => {
  it('removes non-digits', () => {
    expect(normalizePhone('(91) 99999-1234')).toBe('91999991234')
    expect(normalizePhone('91999991234')).toBe('91999991234')
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Test@Email.COM  ')).toBe('test@email.com')
  })
})

describe('getDaysInStage', () => {
  it('returns 0 for today', () => {
    const today = new Date().toISOString()
    expect(getDaysInStage(today)).toBe(0)
  })

  it('returns positive for past dates', () => {
    const past = new Date(Date.now() - 3 * 86400000).toISOString()
    expect(getDaysInStage(past)).toBe(3)
  })
})

describe('isOverdue', () => {
  it('returns true for past dates', () => {
    expect(isOverdue('2020-01-01T00:00:00Z')).toBe(true)
  })

  it('returns false for future dates', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    expect(isOverdue(future)).toBe(false)
  })
})

describe('formatRelativeDate', () => {
  it('returns Hoje for today', () => {
    expect(formatRelativeDate(new Date().toISOString())).toBe('Hoje')
  })

  it('returns Ontem for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000)
    expect(formatRelativeDate(yesterday.toISOString())).toBe('Ontem')
  })

  it('returns days for recent dates', () => {
    const threeDays = new Date(Date.now() - 3 * 86400000)
    expect(formatRelativeDate(threeDays.toISOString())).toBe('3 dias atrás')
  })
})

describe('formatDueAt', () => {
  it('includes Hoje for today', () => {
    const today = new Date()
    today.setHours(14, 30, 0, 0)
    const result = formatDueAt(today.toISOString())
    expect(result).toContain('Hoje')
  })

  it('includes Amanhã for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const result = formatDueAt(tomorrow.toISOString())
    expect(result).toContain('Amanhã')
  })
})

describe('stageMoveErrorMessage', () => {
  it('returns course message for 22023 with capitalized Course interest', () => {
    expect(stageMoveErrorMessage({ code: '22023', message: 'Course interest is required to qualify a lead' }))
      .toBe('Informe o curso de interesse antes de qualificar o Lead.')
  })

  it('returns course message when code arrives as number', () => {
    expect(stageMoveErrorMessage({ code: 22023, message: 'Course interest is required to qualify a lead' }))
      .toBe('Informe o curso de interesse antes de qualificar o Lead.')
  })

  it('returns permission message for 42501', () => {
    expect(stageMoveErrorMessage({ code: '42501', message: 'Permission denied: crm.move_stage' }))
      .toBe('Você não possui permissão para mover este Lead.')
  })

  it('returns null for unknown/unrelated errors', () => {
    expect(stageMoveErrorMessage({ code: 'P0002', message: 'Lead not found' })).toBeNull()
    expect(stageMoveErrorMessage(null)).toBeNull()
  })
})
