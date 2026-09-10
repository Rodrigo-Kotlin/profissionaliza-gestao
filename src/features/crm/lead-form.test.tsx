import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeadForm } from './lead-form'

const useCrmCoursesMock = vi.hoisted(() => vi.fn())
const useCrmPipelineStagesMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn(() => ({ permissions: ['crm.view', 'crm.edit', 'crm.move_stage'] })))

vi.mock('./crm-hooks', () => ({
  useCrmCourses: (status?: string) => {
    useCrmCoursesMock(status)
    return { data: [{ id: 'active-1', name: 'Curso Ativo', modality: 'PRESENCIAL' }], isLoading: false, isError: false }
  },
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCrmPipelineStages: () => {
    useCrmPipelineStagesMock()
    return {
      data: [
        { id: 'stage-1', code: 'PROSPECTING', name: 'Prospecção', position: 1, is_kanban: true },
        { id: 'stage-2', code: 'NEW_LEAD', name: 'Novo Lead', position: 2, is_kanban: true }
      ],
      isLoading: false,
      isError: false
    }
  }
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

describe('LeadForm', () => {
  beforeEach(() => {
    useCrmCoursesMock.mockClear()
    useCrmPipelineStagesMock.mockClear()
    useAuthMock.mockClear()
    useAuthMock.mockImplementation(() => ({ permissions: ['crm.view', 'crm.edit', 'crm.move_stage'] }))
  })

  it('seleciona somente cursos ACTIVE no campo de interesse (courses ativos)', () => {
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    expect(useCrmCoursesMock).toHaveBeenCalledWith('ACTIVE')
  })

  it('renders the stage initial selector when user has crm.move_stage', () => {
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    expect(screen.getByText('Etapa inicial')).toBeInTheDocument()
    expect(screen.getAllByRole('option', { name: 'Prospecção' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('option', { name: 'Novo Lead' }).length).toBeGreaterThanOrEqual(1)
  })

  it('does not render stage selector when user lacks crm.move_stage', () => {
    vi.mocked(useAuthMock).mockImplementation(() => ({ permissions: ['crm.view', 'crm.edit'] }))
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    expect(screen.queryByText('Etapa inicial')).toBeNull()
  })

  it('fetches pipeline stages when user can move stage', () => {
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    expect(useCrmPipelineStagesMock).toHaveBeenCalled()
  })
})
