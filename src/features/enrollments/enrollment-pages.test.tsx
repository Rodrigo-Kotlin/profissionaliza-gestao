import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EnrollmentsPage } from './enrollments-list-page'
import { EnrollmentDetailPage } from './enrollment-detail-page'

const listMock = vi.hoisted(() => vi.fn())
const detailMock = vi.hoisted(() => vi.fn())
const coursesMock = vi.hoisted(() => vi.fn())
const authMock = vi.hoisted(() => vi.fn(() => ({ permissions: [] as string[] })))

vi.mock('./enrollments-hooks', () => ({
  useEnrollmentList: (params: unknown) => { listMock(params); return { data: { data: [row], total: 1, page: 1, page_size: 20 }, isLoading: false, isError: false } },
  useEnrollmentDetail: () => detailMock(),
  useActivateEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePauseEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResumeEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCompleteEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelEnrollment: () => ({ mutateAsync: vi.fn(), isPending: false })
}))
vi.mock('../crm/crm-hooks', () => ({ useCrmCourses: () => coursesMock() }))
vi.mock('@/features/auth/auth-context', () => ({ useAuth: () => authMock() }))

const row = {
  enrollment_id: 'e1', enrollment_code: 'MAT-2026-000001', status: 'ACTIVE', enrollment_date: '2026-10-01T00:00:00Z',
  student_id: 's1', student_code: 'ALU-2026-000001', student_name: 'Ana Exemplo', course_id: 'c1', course_code: 'CURSO-1',
  course_name: 'Curso de Gestão', sale_id: 'sale-1', sale_code: 'VND-2026-000001', contract_id: 'contract-1', contract_code: 'CTR-2026-000001'
} as const

function renderList() {
  return render(<MemoryRouter initialEntries={['/matriculas']}><Routes><Route path="/matriculas" element={<EnrollmentsPage />} /><Route path="/matriculas/:id" element={<div>Enrollment detail route</div>} /></Routes></MemoryRouter>)
}

describe('EnrollmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    coursesMock.mockReturnValue({ data: [{ id: 'c1', name: 'Curso de Gestão' }] })
    listMock.mockReturnValue({ data: { data: [row], total: 1, page: 1, page_size: 20 }, isLoading: false, isError: false })
  })

  it('renders populated desktop/mobile data from the RPC response', () => {
    renderList()
    expect(screen.getByRole('heading', { name: 'Matrículas' })).toBeInTheDocument()
    expect(screen.getAllByText('MAT-2026-000001').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ana Exemplo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Curso de Gestão').length).toBeGreaterThan(0)
  })

  it('keeps filters in URLSearchParams', async () => {
    const user = userEvent.setup()
    renderList()
    await user.type(screen.getByRole('textbox', { name: 'Buscar matrículas' }), 'MAT-2026')
    expect(listMock.mock.calls.at(-1)?.[0]).toMatchObject({ q: 'MAT-2026' })
  })
})

describe('EnrollmentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockReturnValue({ permissions: [] })
    detailMock.mockReturnValue({
      data: {
        enrollment: { id: 'e1', enrollment_code: 'MAT-2026-000001', student_id: 's1', course_id: 'c1', sale_id: 'sale-1', contract_id: 'contract-1', status: 'COMPLETED', enrollment_date: '2026-10-01T00:00:00Z', started_at: '2026-10-02T00:00:00Z', paused_at: null, completed_at: '2026-12-01T00:00:00Z', canceled_at: null, cancellation_reason: null, pause_reason: null, notes: 'Concluído', created_at: '2026-10-01T00:00:00Z', updated_at: '2026-12-01T00:00:00Z' },
        student: { id: 's1', student_code: 'ALU-2026-000001', name: 'Ana Exemplo', status: 'ATIVO' },
        course: { id: 'c1', code: 'CURSO-1', name: 'Curso de Gestão', status: 'ACTIVE' },
        sale: { id: 'sale-1', sale_code: 'VND-2026-000001', status: 'CONFIRMED' },
        contract: { id: 'contract-1', contract_code: 'CTR-2026-000001', status: 'SIGNED' }
      }, isLoading: false, isError: false
    })
  })

  it('renders relations and terminal state without mutations', () => {
    render(<MemoryRouter initialEntries={['/matriculas/e1']}><Routes><Route path="/matriculas/:id" element={<EnrollmentDetailPage />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Matrícula' })).toBeInTheDocument()
    expect(screen.getByText('Ana Exemplo')).toBeInTheDocument()
    expect(screen.getByText('Curso de Gestão')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ativar|pausar|retomar|concluir|cancelar matrícula/i })).toBeNull()
  })
})
