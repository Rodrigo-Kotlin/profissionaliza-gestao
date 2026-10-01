import { describe, expect, it } from 'vitest'
import { formatEnrollmentDate, parseEnrollmentListParams } from './enrollment-utils'

describe('enrollment URL params', () => {
  it('parses supported filters and page', () => {
    const params = new URLSearchParams('q=MAT-2026&status=ACTIVE&course=course-1&date_from=2026-01-01&date_to=2026-12-31&page=2')
    expect(parseEnrollmentListParams(params)).toEqual({ q: 'MAT-2026', status: 'ACTIVE', course_id: 'course-1', date_from: '2026-01-01', date_to: '2026-12-31', page: 2 })
  })

  it('ignores unsupported status and normalizes invalid page', () => {
    expect(parseEnrollmentListParams(new URLSearchParams('status=UNKNOWN&page=0'))).toEqual({ status: undefined, course_id: undefined, date_from: undefined, date_to: undefined, page: 1 })
  })
})

describe('enrollment dates', () => {
  it('formats the enrollment date in pt-BR', () => {
    expect(formatEnrollmentDate('2026-10-01T12:00:00Z')).toBe('01/10/2026')
  })
})
