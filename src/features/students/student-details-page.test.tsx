import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { StudentDetailsPage } from './student-details-page'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['students.view', 'students.edit', 'guardians.manage'] as string[]
})))
const detailMock = vi.hoisted(() => vi.fn())
const guardiansMock = vi.hoisted(() => vi.fn())
const historyMock = vi.hoisted(() => vi.fn())
const changeStatusMock = vi.hoisted(() => vi.fn())
const unlinkMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('./students-hooks', () => ({
  useStudentDetail: () => detailMock(),
  useStudentGuardians: () => guardiansMock(),
  useStudentHistory: () => historyMock(),
  useChangeStudentStatus: () => changeStatusMock(),
  useUnlinkGuardian: () => ({ mutate: unlinkMock, isPending: false })
}))

const student = {
  full_name: 'Carlos Pereira',
  student_code: 'ALU-001',
  preferred_name: null,
  cpf: '12345678900',
  rg: null,
  birth_date: '2000-01-01',
  phone: '11999998888',
  whatsapp: null,
  email: 'carlos@email.com',
  street: 'Rua A',
  number: '10',
  complement: null,
  district: 'Centro',
  city: 'Sao Paulo',
  state: 'SP',
  postal_code: '01000-000',
  emergency_contact_name: null,
  emergency_contact_phone: null,
  notes: null,
  origin: 'INDICACAO',
  status: 'ACTIVE',
  registration_date: '2026-01-01',
  sensitive: false,
  is_active: true
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/alunos/s1']}>
      <Routes>
        <Route path="/alunos/:id" element={<StudentDetailsPage />} />
        <Route path="/alunos" element={<div>Students list page test</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StudentDetailsPage — touch targets (Fase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['students.view', 'students.edit', 'guardians.manage'] as string[] })
    detailMock.mockReturnValue({ data: student, isLoading: false, isError: false })
    guardiansMock.mockReturnValue({
      data: [
        {
          guardian_id: 'g1',
          person_id: 'p1',
          full_name: 'Maria Lima',
          relationship: 'Mae',
          is_primary_contact: true,
          is_financial_responsible: true,
          is_legal_guardian: true,
          phone: '11999990000',
          whatsapp: null,
          email: null
        }
      ],
      isLoading: false,
      isError: false
    })
    historyMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    changeStatusMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  })

  it('remover vínculo é alvo 44x44, tem aria-label e chama unlink', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Responsáveis' }))

    const unlink = screen.getByRole('button', { name: /remover vínculo com maria lima/i })
    expect(unlink.className).toContain('size-11')

    await user.click(unlink)
    expect(unlinkMock).toHaveBeenCalledWith('g1')
  })
})

describe('StudentDetailsPage — continuidade E2E (Fase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['students.view', 'students.edit', 'guardians.manage'] as string[] })
    detailMock.mockReturnValue({ data: student, isLoading: false, isError: false })
    guardiansMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    historyMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    changeStatusMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  })

  it('breadcrumb mostra contexto (Alunos > código) e navega para a lista', async () => {
    const user = userEvent.setup()
    renderPage()
    const nav = screen.getByRole('navigation', { name: 'Navegação estrutural' })
    expect(nav).toHaveTextContent('Alunos')
    expect(nav).toHaveTextContent('ALU-001')
    await user.click(screen.getByRole('button', { name: 'Alunos' }))
    expect(await screen.findByText('Students list page test')).toBeInTheDocument()
  })
})

describe('StudentDetailsPage — Editar respeita permissão (Fase 11.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    detailMock.mockReturnValue({ data: student, isLoading: false, isError: false })
    guardiansMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    historyMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    changeStatusMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })
  })

  it('não exibe Editar sem students.edit', () => {
    useAuthMock.mockReturnValue({ permissions: ['students.view'] as string[] })
    renderPage()
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
  })

  it('exibe Editar quando o usuário tem students.edit', () => {
    useAuthMock.mockReturnValue({ permissions: ['students.view', 'students.edit'] as string[] })
    renderPage()
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
  })
})