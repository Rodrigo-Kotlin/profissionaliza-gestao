import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LeadsPage } from './leads-page'
import { saveLeadDraft } from './lead-draft'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['crm.create', 'crm.view', 'crm.move_stage'],
  profile: null,
  user: null,
  signOut: vi.fn()
})))

const useCreateLeadMock = vi.hoisted(() => vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })))
const useCrmLeadsMock = vi.hoisted(() => vi.fn(() => ({ data: { data: [], total: 0 }, isLoading: false, isError: false })))
const useCrmCoursesMock = vi.hoisted(() => vi.fn(() => ({ data: [], isLoading: false, isError: false })))
const useCrmPipelineStagesMock = vi.hoisted(() => vi.fn(() => ({ data: [], isLoading: false, isError: false })))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('./crm-hooks', () => ({
  useCrmLeads: () => useCrmLeadsMock(),
  useCreateLead: () => useCreateLeadMock(),
  useCrmCourses: () => useCrmCoursesMock(),
  useCrmPipelineStages: () => useCrmPipelineStagesMock()
}))

function renderLeadsPage() {
  return render(
    <MemoryRouter initialEntries={['/crm/leads']}>
      <Routes>
        <Route path="/crm/leads" element={<LeadsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

const selectOrigem = () =>
  screen.getAllByRole('combobox').find((el) =>
    Array.from(el.children).some((o) => o.textContent?.includes('Selecione a origem'))
  ) as HTMLSelectElement

describe('LeadsPage — novo lead nunca herda rascunho anterior (§12)', () => {
  beforeEach(() => {
    useAuthMock.mockClear()
    useCreateLeadMock.mockReset()
    useCrmLeadsMock.mockClear()
    useCrmCoursesMock.mockClear()
    useCrmPipelineStagesMock.mockClear()
    useAuthMock.mockImplementation(() => ({
      permissions: ['crm.create', 'crm.view', 'crm.move_stage'],
      profile: null,
      user: null,
      signOut: vi.fn()
    }))
    sessionStorage.clear()
  })

  it('abre o formulário LIMPO ao clicar "Novo Lead", mesmo com rascunho antigo (Maria)', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue('lead-novo')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })

    saveLeadDraft({ full_name: 'Maria', email: 'maria@email.com' })

    renderLeadsPage()
    await user.click(screen.getByRole('button', { name: /novo lead/i }))

    const nomeInput = screen.getByRole('textbox', { name: /nome completo/i })
    expect(nomeInput).toHaveValue('')

    const emailInput = screen.getByRole('textbox', { name: 'E-mail' })
    expect(emailInput).toHaveValue('')

    expect(sessionStorage.getItem('crm:lead-draft:v2')).toBeNull()
  })

  it('Carlos permanece Carlos ao submeter — nunca resolve para Maria/email antigo', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue('lead-novo')
    useCreateLeadMock.mockReturnValue({ mutateAsync, isPending: false })

    saveLeadDraft({ full_name: 'Maria', email: 'maria@email.com' })

    renderLeadsPage()
    await user.click(screen.getByRole('button', { name: /novo lead/i }))

    await user.type(screen.getByRole('textbox', { name: /nome completo/i }), 'Carlos')
    await user.type(screen.getByRole('textbox', { name: 'Telefone' }), '(11) 99999-8888')
    await user.selectOptions(selectOrigem(), 'OUTRO')
    await user.click(screen.getByRole('button', { name: /criar lead/i }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'Carlos',
      phone: '11999998888',
      email: undefined
    }))
    expect(mutateAsync).not.toHaveBeenCalledWith(expect.objectContaining({ full_name: 'Maria' }))
    expect(mutateAsync).not.toHaveBeenCalledWith(expect.objectContaining({ email: 'maria@email.com' }))
  })

  it('limpa qualquer rascunho legado v1 ao abrir um novo lead', async () => {
    const user = userEvent.setup()
    sessionStorage.setItem('crm:lead-draft:v1', JSON.stringify({ full_name: 'Maria' }))
    renderLeadsPage()
    await user.click(screen.getByRole('button', { name: /novo lead/i }))
    expect(sessionStorage.getItem('crm:lead-draft:v1')).toBeNull()
  })
})