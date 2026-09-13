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
    const envelope = JSON.parse(sessionStorage.getItem('crm:lead-draft:v2') as string)
    expect(envelope.values).toMatchObject({ full_name: 'Carlos' })
    expect(envelope.version).toBe(2)
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
    expect(sessionStorage.getItem('crm:lead-draft:v2')).toBeNull()
  })

  it('renders o campo CPF com label e placeholder', () => {
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('textbox', { name: 'CPF' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('000.000.000-00')).toBeInTheDocument()
  })

  it('permite CPF vazio no cadastro do lead', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue('lead-1')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos Silva')
    const origemSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
    ) as HTMLSelectElement
    await user.selectOptions(origemSelect, 'OUTRO')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith(expect.not.objectContaining({ cpf: expect.anything() }))
  })

  it('aceita CPF válido mascarado e envia normalizado com 11 dígitos', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue('lead-1')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos Silva')
    const origemSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
    ) as HTMLSelectElement
    await user.selectOptions(origemSelect, 'OUTRO')
    await user.type(screen.getByRole('textbox', { name: 'CPF' }), '111.444.777-35')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled())
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ cpf: '11144477735' }))
  })

  it('rejeita CPF inválido com a mensagem "CPF inválido."', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue('lead-1')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos Silva')
    const origemSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
    ) as HTMLSelectElement
    await user.selectOptions(origemSelect, 'OUTRO')
    await user.type(screen.getByRole('textbox', { name: 'CPF' }), '111.444.777-99')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))
    await waitFor(() => expect(screen.getByText('CPF inválido.')).toBeInTheDocument())
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('salva CPF mascarado no rascunho conforme o campo é preenchido', async () => {
    const user = userEvent.setup()
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: 'CPF' }), '11144477735')
    const envelope = JSON.parse(sessionStorage.getItem('crm:lead-draft:v2') as string)
    expect(envelope.values.cpf).toBe('111.444.777-35')
  })

  it('mostra aviso de possível duplicidade e permite criar mesmo assim (force)', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn()
      .mockRejectedValueOnce({ message: 'POSSIBLE_DUPLICATE:phone,email' })
      .mockResolvedValueOnce('lead-1')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos Silva')
    await user.type(screen.getByRole('textbox', { name: 'Telefone' }), '(11) 98888-7777')
    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'carlos@exemplo.com')
    const origemSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
    ) as HTMLSelectElement
    await user.selectOptions(origemSelect, 'OUTRO')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/Já existe uma pessoa com este telefone \/ e-mail/)).toBeInTheDocument()
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: /criar lead mesmo assim/i }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))
    expect(mutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({ force_create: true, full_name: 'Carlos Silva' }))
  })

  it('mostra aviso de divergência de nome (CPF existente) e permite vincular ao cadastro (force)', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn()
      .mockRejectedValueOnce({ message: 'LEAD_NAME_MISMATCH' })
      .mockResolvedValueOnce('lead-1')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Maria de Souza')
    await user.type(screen.getByRole('textbox', { name: 'CPF' }), '11144477735')
    await user.type(screen.getByRole('textbox', { name: 'Telefone' }), '(11) 98888-7777')
    const origemSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
    ) as HTMLSelectElement
    await user.selectOptions(origemSelect, 'OUTRO')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/CPF já está cadastrado para outro nome/)).toBeInTheDocument()
    expect(screen.queryByText(/Já existe uma pessoa com este/)).toBeNull()
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: /vincular ao cpf existente/i }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))
    expect(mutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({
      force_create: true,
      full_name: 'Maria de Souza',
      cpf: '11144477735'
    }))
  })

  it('não aciona o fluxo de força para erros comuns', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockRejectedValue({ message: 'algum erro qualquer' })
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos Silva')
    const origemSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
    ) as HTMLSelectElement
    await user.selectOptions(origemSelect, 'OUTRO')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.queryByRole('button', { name: /criar lead mesmo assim/i })).toBeNull()
  })
})