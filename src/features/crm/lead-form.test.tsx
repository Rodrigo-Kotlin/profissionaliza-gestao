import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeadForm } from './lead-form'
import { saveLeadDraft } from './lead-draft'

const useCrmCoursesMock = vi.hoisted(() => vi.fn())
const useCrmPipelineStagesMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn(() => ({ permissions: ['crm.view', 'crm.edit', 'crm.move_stage'] })))
const useCreateLeadMock = vi.hoisted(() => vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })))

vi.mock('./crm-hooks', () => ({
  useCrmCourses: (status?: string) => {
    useCrmCoursesMock(status)
    return { data: [{ id: 'active-1', name: 'Curso Ativo', modality: 'PRESENCIAL' }], isLoading: false, isError: false }
  },
  useCreateLead: () => useCreateLeadMock(),
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
    useCreateLeadMock.mockReset()
    useCreateLeadMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    useAuthMock.mockImplementation(() => ({ permissions: ['crm.view', 'crm.edit', 'crm.move_stage'] }))
    sessionStorage.clear()
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

  it('restaura rascunho parcial do sessionStorage ao remontar o formulário', () => {
    saveLeadDraft({ full_name: 'Ana', source_code: 'OUTRO' })
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('textbox', { name: /nome completo/i })).toHaveValue('Ana')
  })

  it('salva rascunho no sessionStorage conforme campos são preenchidos', async () => {
    const user = userEvent.setup()
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos')
    expect(JSON.parse(sessionStorage.getItem('crm:lead-draft:v1') as string)).toMatchObject({ full_name: 'Carlos' })
  })

  it('limpa rascunho após criação bem-sucedida', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    const mutateAsync = vi.fn().mockResolvedValue('lead-1')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })
    saveLeadDraft({ full_name: 'Antigo' })
    render(<LeadForm onCreated={onCreated} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos')
    const origemSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
    ) as HTMLSelectElement
    await user.selectOptions(origemSelect, 'OUTRO')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('lead-1'))
    expect(sessionStorage.getItem('crm:lead-draft:v1')).toBeNull()
  })
})