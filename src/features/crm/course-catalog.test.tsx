import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { CourseCatalog } from './course-catalog'

const mockCourse = () => ({
  id: 'c1',
  code: 'ADM',
  name: 'Auxiliar Administrativo',
  short_name: 'ADM',
  category: null,
  modality: 'PRESENCIAL' as const,
  workload_hours: 40,
  duration_value: null,
  duration_unit: null,
  default_price: 500,
  description: null,
  status: 'DRAFT' as const
})

const mockState = vi.hoisted(() => ({
  permissions: ['courses.manage', 'crm.view'],
  data: [] as unknown[],
  createCourse: vi.fn(),
  updateCourse: vi.fn()
}))

vi.mock('./crm-hooks', () => ({
  useCrmCourses: () => ({ data: mockState.data, isLoading: false, isError: false }),
  useCreateCourse: () => ({ mutateAsync: mockState.createCourse, isPending: false, error: null }),
  useUpdateCourse: () => ({ mutateAsync: mockState.updateCourse, isPending: false, error: null })
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ permissions: mockState.permissions })
}))

describe('CourseCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.data = [mockCourse()]
  })

  it('esconde ações de criação/edição para permission courses.view', () => {
    mockState.permissions = ['courses.view']
    render(<CourseCatalog />)
    expect(screen.queryByRole('button', { name: /novo curso/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
    expect(screen.getAllByText('Auxiliar Administrativo').length).toBeGreaterThan(0)
  })

  it('mostra botão Novo Curso com permission courses.manage', () => {
    mockState.permissions = ['courses.manage']
    render(<CourseCatalog />)
    expect(screen.getByRole('button', { name: /novo curso/i })).toBeInTheDocument()
  })

  it('persiste via createCourse ao criar curso (sucesso real apenas após RPC)', async () => {
    const user = userEvent.setup()
    mockState.createCourse.mockResolvedValue('new-course-id')
    render(<CourseCatalog />)

    await user.click(screen.getByRole('button', { name: /novo curso/i }))

    await user.type(screen.getAllByLabelText(/código/i)[0]!, 'ADM-TESTE')
    await user.type(screen.getAllByLabelText(/^nome/i)[0]!, 'Auxiliar Administrativo — Teste')
    await user.type(screen.getByLabelText(/carga horária \(/i), '40')
    await user.type(screen.getByLabelText(/valor \(/i), '500')
    await user.click(screen.getByRole('button', { name: /criar curso/i }))

    await waitFor(() => {
      expect(mockState.createCourse).toHaveBeenCalledTimes(1)
    })
    const payload = mockState.createCourse.mock.calls[0]![0]!
    expect(payload.code).toBe('ADM-TESTE')
    expect(payload.name).toBe('Auxiliar Administrativo — Teste')
  })

  it('chama updateCourse ao editar um curso existente', async () => {
    const user = userEvent.setup()
    mockState.updateCourse.mockResolvedValue(undefined)
    render(<CourseCatalog />)

    await user.click(screen.getAllByRole('button', { name: /editar/i })[0]!)
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(mockState.updateCourse).toHaveBeenCalledTimes(1)
    })
    expect(mockState.updateCourse.mock.calls[0]![0]!.courseId).toBe('c1')
  })

  it('não mostra toast de sucesso nem fecha modal quando a RPC falha', async () => {
    const user = userEvent.setup()
    mockState.createCourse.mockRejectedValue(new Error('boom'))
    const successSpy = vi.spyOn(toast, 'success')
    render(<CourseCatalog />)

    await user.click(screen.getByRole('button', { name: /novo curso/i }))
    await user.type(screen.getAllByLabelText(/código/i)[0]!, 'ADM-TESTE')
    await user.type(screen.getAllByLabelText(/^nome/i)[0]!, 'Auxiliar Administrativo — Teste')
    await user.click(screen.getByRole('button', { name: /criar curso/i }))

    await waitFor(() => {
      expect(mockState.createCourse).toHaveBeenCalledTimes(1)
    })
    expect(successSpy).not.toHaveBeenCalled()
    expect(screen.getAllByLabelText(/código/i).length).toBeGreaterThan(0)
  })

  it('mostra mensagem específica para código duplicado (23505)', async () => {
    const user = userEvent.setup()
    mockState.createCourse.mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "courses_code_key"'
    })
    render(<CourseCatalog />)

    await user.click(screen.getByRole('button', { name: /novo curso/i }))
    await user.type(screen.getAllByLabelText(/código/i)[0]!, 'ADM-TESTE')
    await user.type(screen.getAllByLabelText(/^nome/i)[0]!, 'Curso Duplicado')
    await user.click(screen.getByRole('button', { name: /criar curso/i }))

    await waitFor(() => {
      const matches = screen.getAllByText('Já existe um curso com esse código.')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByLabelText(/código/i).length).toBeGreaterThan(0)
  })

  it('mostra mensagem de erro de permissão para 42501', async () => {
    const user = userEvent.setup()
    mockState.createCourse.mockRejectedValue({
      code: '42501',
      message: 'Permission denied'
    })
    render(<CourseCatalog />)

    await user.click(screen.getByRole('button', { name: /novo curso/i }))
    await user.type(screen.getAllByLabelText(/código/i)[0]!, 'ADM-TESTE')
    await user.type(screen.getAllByLabelText(/^nome/i)[0]!, 'Curso Teste')
    await user.click(screen.getByRole('button', { name: /criar curso/i }))

    await waitFor(() => {
      expect(screen.getByText('Você não possui permissão para gerenciar cursos.')).toBeInTheDocument()
    })
  })

  it('mostra mensagem genérica para erros desconhecidos', async () => {
    const user = userEvent.setup()
    mockState.createCourse.mockRejectedValue({
      code: 'XX999',
      message: 'unknown error'
    })
    render(<CourseCatalog />)

    await user.click(screen.getByRole('button', { name: /novo curso/i }))
    await user.type(screen.getAllByLabelText(/código/i)[0]!, 'ADM-TESTE')
    await user.type(screen.getAllByLabelText(/^nome/i)[0]!, 'Curso Teste')
    await user.click(screen.getByRole('button', { name: /criar curso/i }))

    await waitFor(() => {
      expect(screen.getByText('Não foi possível salvar o curso.')).toBeInTheDocument()
    })
  })

  it('não exibe select de status editável na criação de curso', async () => {
    const user = userEvent.setup()
    render(<CourseCatalog />)

    await user.click(screen.getByRole('button', { name: /novo curso/i }))

    expect(screen.getByText('Rascunho (padrão)')).toBeInTheDocument()
    const selects = screen.queryAllByRole('combobox')
    const statusSelects = selects.filter((s) => {
      const options = Array.from(s.querySelectorAll('option'))
      return options.some((o) => o.value === 'ACTIVE')
    })
    expect(statusSelects.length).toBe(0)
  })

  it('exibe select de status editável na edição de curso', async () => {
    const user = userEvent.setup()
    render(<CourseCatalog />)

    await user.click(screen.getAllByRole('button', { name: /editar/i })[0]!)

    const selects = screen.getAllByRole('combobox')
    const statusSelects = selects.filter((s) => {
      const options = Array.from(s.querySelectorAll('option'))
      return options.some((o) => o.value === 'ACTIVE')
    })
    expect(statusSelects.length).toBe(1)
  })

  it('normaliza código em maiúsculas no submit', async () => {
    const user = userEvent.setup()
    mockState.createCourse.mockResolvedValue('new-course-id')
    render(<CourseCatalog />)

    await user.click(screen.getByRole('button', { name: /novo curso/i }))
    await user.type(screen.getAllByLabelText(/código/i)[0]!, '  adm-teste  ')
    await user.type(screen.getAllByLabelText(/^nome/i)[0]!, 'Curso Normalizado')
    await user.click(screen.getByRole('button', { name: /criar curso/i }))

    await waitFor(() => {
      expect(mockState.createCourse).toHaveBeenCalledTimes(1)
    })
    const payload = mockState.createCourse.mock.calls[0]![0]!
    expect(payload.code).toBe('ADM-TESTE')
  })
})
