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
    // catálogo continua visível
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

    // preenche os campos obrigatórios
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
    // modal permanece aberto (campo código ainda visível)
    expect(screen.getAllByLabelText(/código/i).length).toBeGreaterThan(0)
  })
})
