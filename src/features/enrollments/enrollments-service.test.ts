import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enrollmentsService } from './enrollments-service'
import { OfflineConnectionError } from '@/lib/offline'

const rpcMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

describe('enrollmentsService.list', () => {
  beforeEach(() => rpcMock.mockReset())

  it('uses list_enrollments with supported filters including student', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, page_size: 20 }, error: null })
    await enrollmentsService.list({ q: 'Aluno', status: 'ACTIVE', course_id: 'course-1', student_id: 'student-1', date_from: '2026-01-01', date_to: '2026-12-31', page: 2, page_size: 10 })
    expect(rpcMock).toHaveBeenCalledWith('list_enrollments', {
      p_q: 'Aluno', p_status: 'ACTIVE', p_course_id: 'course-1', p_student_id: 'student-1',
      p_date_from: '2026-01-01', p_date_to: '2026-12-31', p_page: 2, p_page_size: 10
    })
  })
})

describe('enrollmentsService.detail', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls get_enrollment_detail', async () => {
    rpcMock.mockResolvedValue({ data: { enrollment: { id: 'enrollment-1' } }, error: null })
    await enrollmentsService.detail('enrollment-1')
    expect(rpcMock).toHaveBeenCalledWith('get_enrollment_detail', { p_enrollment_id: 'enrollment-1' })
  })
})

describe('enrollment mutations', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true })
  })

  it.each([
    ['activate_enrollment', () => enrollmentsService.activate('e1'), { p_enrollment_id: 'e1' }],
    ['resume_enrollment', () => enrollmentsService.resume('e1'), { p_enrollment_id: 'e1' }],
    ['complete_enrollment', () => enrollmentsService.complete('e1'), { p_enrollment_id: 'e1' }],
    ['pause_enrollment', () => enrollmentsService.pause('e1', 'Agenda acadêmica'), { p_enrollment_id: 'e1', p_reason: 'Agenda acadêmica' }],
    ['cancel_enrollment', () => enrollmentsService.cancel('e1', 'Solicitação do aluno'), { p_enrollment_id: 'e1', p_reason: 'Solicitação do aluno' }]
  ])('%s uses the domain RPC', async (name, call, args) => {
    rpcMock.mockResolvedValue({ data: {}, error: null })
    await call()
    expect(rpcMock).toHaveBeenCalledWith(name, args)
  })

  it('propagates RPC failures', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('Only active enrollments can be paused') })
    await expect(enrollmentsService.pause('e1', 'reason')).rejects.toThrow('Only active enrollments can be paused')
  })

  it('blocks pause offline before reaching the backend', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })

    await expect(enrollmentsService.pause('e1', 'Sem conexão')).rejects.toBeInstanceOf(OfflineConnectionError)
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
