import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { StudentsPage } from './students-page'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({ permissions: ['students.view', 'students.edit'] as string[] })))
const useStudentsMock = vi.hoisted(() => vi.fn<(params: unknown) => { data: unknown; isLoading: boolean; isError: boolean }>(() => ({ data: null, isLoading: false, isError: false })))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('./students-hooks', () => ({
  useStudents: (params: unknown) => useStudentsMock(params)
}))

function renderPage(initialEntries: string[] = ['/alunos']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/alunos" element={<><StudentsPage /><LocationProbe /></>} />
        <Route path="/alunos/:id" element={<AlunoDetailRoute />} />
      </Routes>
    </MemoryRouter>
  )
}

function LocationProbe() {
  const [search] = useSearchParams()
  return <span data-testid="location-search">{search.toString()}</span>
}

function AlunoDetailRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div>
      Aluno page test
      <button onClick={() => navigate(-1)}>Voltar {id}</button>
    </div>
  )
}

const lastStudentsCall = () => (useStudentsMock.mock.calls[useStudentsMock.mock.calls.length - 1]?.[0] ?? {}) as Record<string, unknown>

describe('StudentsPage — touch targets (Fase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['students.view', 'students.edit'] as string[] })
    useStudentsMock.mockReturnValue({
      data: {
        data: [
          {
            student_id: 's1',
            student_code: 'ALU-001',
            full_name: 'Carlos Pereira',
            cpf: null,
            phone: null,
            whatsapp: null,
            email: null,
            origin: null,
            status: 'ACTIVE',
            registration_date: '2026-01-01'
          }
        ],
        total: 1
      },
      isLoading: false,
      isError: false
    })
  })

  it('Ver aluno (desktop e mobile) e paginação mantêm alvo de 44px', async () => {
    const user = userEvent.setup()
    renderPage()

    const verAluno = await screen.findAllByRole('button', { name: /ver aluno/i })
    expect(verAluno.length).toBeGreaterThan(0)
    for (const button of verAluno) {
      expect(button.className).toMatch(/(^|\s)(min-h-11|h-11)(\s|$)/)
    }

    for (const label of ['Anterior', 'Próxima']) {
      expect(screen.getByRole('button', { name: label }).className).toContain('min-h-11')
    }

    await user.click(verAluno[0]!)
    expect(await screen.findByText('Aluno page test')).toBeInTheDocument()
  })
})

describe('StudentsPage — persistência de filtros na URL (Fase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['students.view', 'students.edit'] as string[] })
    useStudentsMock.mockReturnValue({ data: { data: [] as unknown[], total: 30 }, isLoading: false, isError: false })
  })

  it('URL inicial popula filtros e página', () => {
    renderPage(['/alunos?status=ATIVO&page=2'])
    expect(lastStudentsCall().status).toBe('ATIVO')
    expect(lastStudentsCall().page).toBe(2)
  })

  it('alterar filtro atualiza a URL', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'ATIVO')
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toContain('status=ATIVO'))
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), '')
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).not.toMatch(/status=/))
  })

  it('alterar filtro reseta page para 1', async () => {
    const user = userEvent.setup()
    renderPage(['/alunos?status=ATIVO&page=3'])

    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'INATIVO')
    await waitFor(() => {
      expect(lastStudentsCall().status).toBe('INATIVO')
      expect(lastStudentsCall().page).toBe(1)
    })
    expect(screen.getByTestId('location-search').textContent).not.toMatch(/page=/)
  })

  it('page inválida ou negativa cai para 1', () => {
    renderPage(['/alunos?page=abc'])
    expect(lastStudentsCall().page).toBe(1)

    useStudentsMock.mockClear()
    renderPage(['/alunos?page=-3'])
    expect(lastStudentsCall().page).toBe(1)
  })

  it('limpar filtros remove parâmetros da URL', async () => {
    const user = userEvent.setup()
    renderPage(['/alunos?q=Ana&status=ATIVO'])

    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).not.toMatch(/q=/)
      expect(screen.getByTestId('location-search').textContent).not.toMatch(/status=/)
    })
  })

  it('retorno do detalhe preserva filtros e página', async () => {
    const user = userEvent.setup()
    useStudentsMock.mockReturnValue({
      data: {
        data: [{ student_id: 's1', student_code: 'ALU-001', full_name: 'Carlos Pereira', cpf: null, phone: null, whatsapp: null, email: null, origin: null, status: 'ATIVO', registration_date: '2026-01-01' }],
        total: 26
      },
      isLoading: false,
      isError: false
    })
    renderPage(['/alunos?status=ATIVO&page=2'])

    await user.click(screen.getAllByRole('button', { name: /ver aluno/i })[0]!)
    expect(await screen.findByText('Aluno page test')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /voltar/i }))
    expect(screen.queryByText('Aluno page test')).toBeNull()
    expect(lastStudentsCall().status).toBe('ATIVO')
    expect(lastStudentsCall().page).toBe(2)
  })
})

describe('StudentsPage — paginação responsiva em 320px (Fase 11.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['students.view', 'students.edit'] as string[] })
    useStudentsMock.mockReturnValue({
      data: {
        data: [{ student_id: 's1', student_code: 'ALU-001', full_name: 'Carlos Pereira', cpf: null, phone: null, whatsapp: null, email: null, origin: null, status: 'ATIVO', registration_date: '2026-01-01' }],
        total: 80
      },
      isLoading: false,
      isError: false
    })
  })

  it('page size e navegação seguem funcionais e estrutura quebra em duas linhas no mobile', async () => {
    const user = userEvent.setup()
    renderPage()

    const sizeSelect = screen.getByRole('combobox', { name: /itens por página/i })
    const group = sizeSelect.parentElement as HTMLElement
    expect(group.className).toContain('flex-col')
    expect(group.className).toContain('sm:flex-row')

    await user.selectOptions(sizeSelect, '50')
    expect(await screen.findByTestId('location-search')).toHaveTextContent('page_size=50')

    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByTestId('location-search')).toHaveTextContent('page=2')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()
  })
})

describe('StudentsPage — Ver aluno mobile e normalização de página (Fase 11.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStudentsMock.mockReturnValue({
      data: {
        data: [{ student_id: 's1', student_code: 'ALU-001', full_name: 'Carlos Pereira', cpf: null, phone: null, whatsapp: null, email: null, origin: null, status: 'ATIVO', registration_date: '2026-01-01' }],
        total: 1
      },
      isLoading: false,
      isError: false
    })
  })

  it('usuário com view e sem edit vê Ver aluno no mobile e no desktop', () => {
    useAuthMock.mockReturnValue({ permissions: ['students.view'] as string[] })
    renderPage()

    const buttons = screen.getAllByRole('button', { name: 'Ver aluno' })
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    for (const button of buttons) {
      expect(button.className).toMatch(/(^|\s)(min-h-11|h-11)(\s|$)/)
    }
  })

  it('page=999 normaliza para a última página válida', async () => {
    useAuthMock.mockReturnValue({ permissions: ['students.view', 'students.edit'] as string[] })
    useStudentsMock.mockReturnValue({
      data: {
        data: [{ student_id: 's1', student_code: 'ALU-001', full_name: 'Carlos Pereira', cpf: null, phone: null, whatsapp: null, email: null, origin: null, status: 'ATIVO', registration_date: '2026-01-01' }],
        total: 43
      },
      isLoading: false,
      isError: false
    })
    renderPage(['/alunos?page=999'])

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('page=3')
    })
    expect(lastStudentsCall().page).toBe(3)
  })
})