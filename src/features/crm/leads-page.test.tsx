import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LeadsPage } from './leads-page'
import { saveLeadDraft } from './lead-draft'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['crm.create', 'crm.view', 'crm.move_stage'],
  profile: null,
  user: null,
  signOut: vi.fn()
})))

const useCreateLeadMock = vi.hoisted(() => vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })))
const useCrmLeadsMock = vi.hoisted(() => vi.fn(() => ({ data: { data: [] as unknown[], total: 0 }, isLoading: false, isError: false })))
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

function renderLeadsPage(initialEntries: string[] = ['/crm/leads']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/crm/leads" element={<><LeadsPage /><LocationProbe /></>} />
        <Route path="/crm/leads/:id" element={<LeadDetailRoute />} />
      </Routes>
    </MemoryRouter>
  )
}

function LocationProbe() {
  const [search] = useSearchParams()
  return <span data-testid="location-search">{search.toString()}</span>
}

function LeadDetailRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return (
    <div>
      Lead detail test
      <button onClick={() => navigate(-1)}>Voltar {id}</button>
    </div>
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

describe('LeadsPage — touch targets (Fase 6)', () => {
  it('Ver lead, Anterior e Próxima mantêm alvo mínimo de 44px', async () => {
    useCrmLeadsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 'lead-1',
            lead_code: 'CRM-0001',
            full_name: 'Ana Souza',
            phone: null,
            whatsapp: null,
            stage_code: 'NOVO_LEAD',
            stage_name: 'Novo Lead',
            source_name: null,
            course_name: null,
            owner_name: null,
            owner_user_id: 'u1',
            temperature: null,
            status: 'OPEN',
            created_at: '2026-01-01T10:00:00Z',
            updated_at: '2026-01-01T10:00:00Z',
            days_in_pipeline: 1,
            next_activity_summary: null,
            next_activity_at: null,
            overdue_count: 0
          }
        ],
        total: 1
      },
      isLoading: false,
      isError: false
    })
    renderLeadsPage()

    const verLead = await screen.findAllByRole('button', { name: /ver lead/i })
    expect(verLead.length).toBeGreaterThan(0)
    for (const button of verLead) {
      expect(button.className).toMatch(/(^|\s)(min-h-11|h-11)(\s|$)/)
    }

    for (const label of ['Anterior', 'Próxima']) {
      expect(screen.getByRole('button', { name: label }).className).toContain('min-h-11')
    }
  })
})

describe('LeadsPage — persistência de filtros na URL (Fase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockImplementation(() => ({
      permissions: ['crm.create', 'crm.view', 'crm.move_stage'],
      profile: null, user: null, signOut: vi.fn()
    }))
    useCrmLeadsMock.mockReset()
    useCrmLeadsMock.mockReturnValue({ data: { data: [] as unknown[], total: 26 }, isLoading: false, isError: false })
  })

  it('URL inicial popula filtros e página', () => {
    renderLeadsPage(['/crm/leads?status=OPEN&page=2'])
    expect(screen.getByTestId('location-search').textContent).toContain('status=OPEN&page=2')
  })

  it('alterar filtro atualiza a URL', async () => {
    const user = userEvent.setup()
    renderLeadsPage()
    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'WON')
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('status=WON')
    })
  })

  it('page inválida não causa erro', () => {
    renderLeadsPage(['/crm/leads?page=abc'])
    expect(screen.getByTestId('location-search').textContent).toContain('page=abc')
  })

  it('limpar filtros remove parâmetros da URL', async () => {
    const user = userEvent.setup()
    renderLeadsPage(['/crm/leads?status=WON&page=3'])
    await user.click(screen.getByRole('button', { name: 'Limpar' }))
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).not.toMatch(/status=/)
      expect(screen.getByTestId('location-search').textContent).not.toMatch(/page=/)
    })
  })

  it('retorno do detalhe preserva contexto', async () => {
    const user = userEvent.setup()
    useCrmLeadsMock.mockReturnValue({
      data: {
        data: [{
          id: 'lead-1',
          lead_code: 'CRM-0001',
          full_name: 'Ana Souza',
          phone: null,
          whatsapp: null,
          stage_code: 'NOVO_LEAD',
          stage_name: 'Novo Lead',
          source_name: null,
          course_name: null,
          owner_name: null,
          owner_user_id: 'u1',
          temperature: null,
          status: 'OPEN',
          created_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
          days_in_pipeline: 1,
          next_activity_summary: null,
          next_activity_at: null,
          overdue_count: 0
        }],
        total: 26
      },
      isLoading: false,
      isError: false
    })
    renderLeadsPage(['/crm/leads?status=OPEN&page=2'])

    await user.click(screen.getAllByRole('button', { name: /ver lead/i })[0]!)
    expect(await screen.findByText('Lead detail test')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /voltar/i }))
    expect(screen.queryByText('Lead detail test')).toBeNull()
    expect(screen.getByTestId('location-search').textContent).toContain('status=OPEN&page=2')
  })
})

describe('LeadsPage — paginação responsiva em 320px (Fase 11.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['crm.view', 'crm.move_stage'], profile: null, user: null, signOut: vi.fn() })
    useCrmLeadsMock.mockReturnValue({
      data: {
        data: [{
          id: 'lead-1',
          lead_code: 'CRM-0001',
          full_name: 'Ana Souza',
          phone: null,
          whatsapp: null,
          stage_code: 'NOVO_LEAD',
          stage_name: 'Novo Lead',
          source_name: null,
          course_name: null,
          owner_name: null,
          owner_user_id: 'u1',
          temperature: null,
          status: 'OPEN',
          created_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
          days_in_pipeline: 1,
          next_activity_summary: null,
          next_activity_at: null,
          overdue_count: 0
        }],
        total: 80
      },
      isLoading: false,
      isError: false
    })
  })

  it('page size e navegação seguem funcionais e estrutura quebra em duas linhas no mobile', async () => {
    const user = userEvent.setup()
    renderLeadsPage()

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

describe('LeadsPage — normalização page > total (Fase 11.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['crm.view', 'crm.move_stage'], profile: null, user: null, signOut: vi.fn() })
    useCrmLeadsMock.mockReturnValue({
      data: {
        data: [{
          id: 'lead-1',
          lead_code: 'CRM-0001',
          full_name: 'Ana Souza',
          phone: null,
          whatsapp: null,
          stage_code: 'NOVO_LEAD',
          stage_name: 'Novo Lead',
          source_name: null,
          course_name: null,
          owner_name: null,
          owner_user_id: 'u1',
          temperature: null,
          status: 'OPEN',
          created_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
          days_in_pipeline: 1,
          next_activity_summary: null,
          next_activity_at: null,
          overdue_count: 0
        }],
        total: 43
      },
      isLoading: false,
      isError: false
    })
  })

  it('page=999 normaliza para a última página válida', async () => {
    renderLeadsPage(['/crm/leads?page=999'])

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('page=2')
    })
  })
})