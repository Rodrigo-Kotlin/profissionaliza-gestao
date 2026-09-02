import { describe, expect, it } from 'vitest'
import {
  formatCpf,
  getNextStatuses,
  isValidCpf,
  maskCpf,
  maskEmail,
  maskPhone,
  normalizeCep,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  normalizeState,
  parseStudentListParams
} from './students-utils'

describe('normalizeCpf', () => {
  it('removes punctuation and keeps digits', () => {
    expect(normalizeCpf('111.444.777-35')).toBe('11144477735')
  })
  it('is idempotent', () => {
    expect(normalizeCpf('11144477735')).toBe('11144477735')
  })
})

describe('isValidCpf', () => {
  it('accepts a known valid CPF', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true)
  })
  it('rejects repeated digits', () => {
    expect(isValidCpf('000.000.000-00')).toBe(false)
  })
  it('rejects wrong length', () => {
    expect(isValidCpf('123')).toBe(false)
  })
  it('rejects invalid check digits', () => {
    expect(isValidCpf('111.444.777-99')).toBe(false)
  })
})

describe('contact normalization', () => {
  it('normalizes phone', () => {
    expect(normalizePhone('(11) 99999-8888')).toBe('11999998888')
  })
  it('normalizes email to lowercase', () => {
    expect(normalizeEmail('  ana@exemplo.COM ')).toBe('ana@exemplo.com')
  })
  it('normalizes state to 2 uppercase letters', () => {
    expect(normalizeState('  sp ')).toBe('SP')
  })
  it('normalizes CEP removing leading zeros', () => {
    expect(normalizeCep('01.234-567')).toBe('1234567')
  })
})

describe('masking (LGPD)', () => {
  it('masks CPF keeping last two digits', () => {
    expect(maskCpf('111.444.777-35')).toBe('***.***.***-35')
  })
  it('masks phone keeping last four digits', () => {
    expect(maskPhone('11999998888')).toBe('••••-8888')
  })
  it('masks email keeping first char and domain', () => {
    expect(maskEmail('ana@exemplo.com')).toBe('a***@exemplo.com')
  })
})

describe('formatCpf', () => {
  it('formats a valid CPF', () => {
    expect(formatCpf('11144477735')).toBe('111.444.777-35')
  })
  it('returns raw digits when invalid', () => {
    expect(formatCpf('123')).toBe('123')
  })
})

describe('parseStudentListParams', () => {
  it('reads filters with defaults', () => {
    const params = parseStudentListParams(new URLSearchParams('q=ana&status=ATIVO&page=2'), { pageSize: 50 })
    expect(params.query).toBe('ana')
    expect(params.status).toBe('ATIVO')
    expect(params.page).toBe(2)
    expect(params.pageSize).toBe(50)
    expect(params.sort).toBe('full_name')
    expect(params.sortDir).toBe('ASC')
  })
  it('clamps page size to 100', () => {
    const params = parseStudentListParams(new URLSearchParams('page_size=999'))
    expect(params.pageSize).toBe(100)
  })
  it('parses DESC direction', () => {
    const params = parseStudentListParams(new URLSearchParams('dir=desc'))
    expect(params.sortDir).toBe('DESC')
  })
})

describe('getNextStatuses', () => {
  it('maps valid transitions', () => {
    expect(getNextStatuses('ATIVO')).toEqual(['INATIVO', 'CANCELADO', 'CONCLUIDO'])
  })
  it('returns empty for unknown status', () => {
    expect(getNextStatuses('QUALQUER')).toEqual([])
  })
})