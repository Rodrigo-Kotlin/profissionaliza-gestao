import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EnrollmentActions } from './enrollment-actions'

const authMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => authMock() }))
vi.mock('./enrollments-hooks', () => ({
  useActivateEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePauseEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResumeEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCompleteEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

const base = { id: 'e1', enrollment_code: 'MAT-2026-000001', student_id: 's1', course_id: 'c1', sale_id: 'sale-1', contract_id: 'contract-1', enrollment_date: '2026-10-01', started_at: null, paused_at: null, completed_at: null, canceled_at: null, cancellation_reason: null, pause_reason: null, notes: null, created_at: '2026-10-01', updated_at: '2026-10-01' }

describe('EnrollmentActions', () => {
  beforeEach(() => authMock.mockReturnValue({ permissions: ['enrollments.activate', 'enrollments.pause', 'enrollments.resume', 'enrollments.complete', 'enrollments.cancel'] }))

  it('shows both valid pending actions', () => {
    render(<EnrollmentActions enrollment={{ ...base, status: 'PENDING' }} />)
    expect(screen.getByRole('button', { name: /ativar matrícula/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar matrícula/i })).toBeInTheDocument()
  })

  it('shows all valid active actions instead of returning after the first one', () => {
    render(<EnrollmentActions enrollment={{ ...base, status: 'ACTIVE', started_at: '2026-10-02' }} />)
    expect(screen.getByRole('button', { name: /pausar matrícula/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /concluir matrícula/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar matrícula/i })).toBeInTheDocument()
  })

  it('renders no mutation for terminal states', () => {
    render(<EnrollmentActions enrollment={{ ...base, status: 'CANCELED' }} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
