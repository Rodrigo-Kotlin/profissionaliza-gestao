import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContractsPage } from './contracts-list-page'
import type { ContractListItem, ContractListResponse } from './contracts-types'
import { CONTRACT_PAGE_SIZE } from './contracts-constants'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['contracts.view', 'contracts.view_all'],
  profile: null,
  user: null,
  signOut: vi.fn()
})))

const useContractListMock = vi.hoisted(() => vi.fn())
const useCrmCoursesMock = vi.hoisted(() => vi.fn(() => ({ data: [], isLoading: false, isError: false })))
const supabaseFromMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('@/features/contracts/contracts-hooks', () => ({
  useContractList: (params: unknown) => useContractListMock(params)
}))

vi.mock('@/features/crm/crm-hooks', () => ({
  useCrmCourses: () => useCrmCoursesMock()
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock
  }
}))

function queryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function makeContract(overrides: Partial<ContractListItem> = {}): ContractListItem {
  return {
    contract_id: 'c1',
    contract_code: 'CON-2026-000001',
    status: 'DRAFT',
    student_id: 's1',
    student_code: 'ALU-2026-0001',
    student_name: 'Ana Souza',
    contractor_name: 'Maria Souza',
    course_name: 'Curso de Enfermagem',
    seller_user_id: 'u1',
    seller_name: 'Carlos Vendedor',
    net_value_snapshot: 1800,
    created_at: '2026-09-05T10:00:00.000Z',
    issued_at: null,
    signed_at: null,
    ...overrides
  }
}

function renderContractsPage(contracts: ContractListItem[] = [], total: number = contracts.length, initialEntries: string[] = ['/contratos']) {
  const client = queryClient()
  supabaseFromMock.mockReturnValue({
    select: vi.fn(() => ({ order: vi.fn(() => ({ data: [], error: null })) }))
  })
  useContractListMock.mockReturnValue({
    data: { data: contracts, total, page: 1, page_size: CONTRACT_PAGE_SIZE } satisfies ContractListResponse,
    isLoading: false,
    isError: false
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/contratos" element={<><ContractsPage /><LocationProbe /></>} />
          <Route path="/contratos/:id" element={<ContractDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function LocationProbe() {
  const [search] = useSearchParams()
  return <span data-testid="location-search">{search.toString()}</span>
}

function ContractDetailRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <div>Detalhe do contrato {id} <button onClick={() => navigate(-1)}>Voltar</button></div>
}

const lastContractListCall = () => useContractListMock.mock.calls[useContractListMock.mock.calls.length - 1]?.[0] as Record<string, unknown>

describe('ContractsPage — contratos responsivo (Fase 2)', () => {
  beforeEach(() => {
    useAuthMock.mockClear()
    useContractListMock.mockClear()
    useCrmCoursesMock.mockClear()
    supabaseFromMock.mockClear()
    useAuthMock.mockImplementation(() => ({
      permissions: ['contracts.view', 'contracts.view_all'],
      profile: null,
      user: null,
      signOut: vi.fn()
    }))
  })

  it('mobileCard continua renderizando as informações essenciais', () => {
    renderContractsPage([makeContract()])

    const cards = screen.getByRole('list')
    const card = within(cards)
    expect(card.getByText('CON-2026-000001')).toBeTruthy()
    expect(card.getByText('Ana Souza')).toBeTruthy()
    expect(card.getByText('Maria Souza')).toBeTruthy()
    expect(card.getByText('Rascunho')).toBeTruthy()
    expect(card.getByText('R$ 1.800')).toBeTruthy()
    expect(card.getByText('Curso de Enfermagem')).toBeTruthy()
  })

  it('botão Ver contrato está acessível e navega para o detalhe', async () => {
    const user = userEvent.setup()
    renderContractsPage([makeContract()])

    const cardButton = within(screen.getByRole('list')).getByRole('button', { name: 'Ver contrato' })
    expect(cardButton).toBeTruthy()

    await user.click(cardButton)
    expect(await screen.findByText('Detalhe do contrato c1')).toBeTruthy()
  })

  it('botão limpar busca possui nome acessível e limpa o filtro', async () => {
    const user = userEvent.setup()
    renderContractsPage()

    const searchInput = screen.getByPlaceholderText('Buscar por código, aluno ou contratante...')
    await user.type(searchInput, 'Ana')

    await waitFor(() => {
      expect(lastContractListCall().search).toBe('Ana')
    })

    const clearButton = screen.getByRole('button', { name: 'Limpar busca' })
    expect(clearButton).toBeTruthy()
    await user.click(clearButton)

    await waitFor(() => {
      expect(lastContractListCall().search).toBeUndefined()
    })
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull()
  })

  it('pills de status continuam filtrando', async () => {
    const user = userEvent.setup()
    renderContractsPage([makeContract()])

    await user.click(screen.getByRole('button', { name: 'Rascunhos' }))
    await waitFor(() => {
      expect(lastContractListCall().status).toBe('DRAFT')
    })

    await user.click(screen.getByRole('button', { name: 'Assinados' }))
    await waitFor(() => {
      expect(lastContractListCall().status).toBe('SIGNED')
    })

    await user.click(screen.getByRole('button', { name: 'Todos' }))
    await waitFor(() => {
      expect(lastContractListCall().status).toBeUndefined()
    })
  })

  it('filtro de período continua funcional', async () => {
    const user = userEvent.setup()
    renderContractsPage()

    await user.type(screen.getByLabelText('Data inicial'), '2026-01-01')
    await waitFor(() => {
      expect(lastContractListCall().date_from).toBe('2026-01-01')
    })

    await user.type(screen.getByLabelText('Data final'), '2026-12-31')
    await waitFor(() => {
      expect(lastContractListCall().date_to).toBe('2026-12-31')
    })
  })

  it('tabela desktop permanece preservada com as colunas ricas', () => {
    renderContractsPage([makeContract()])

    const table = within(screen.getByRole('table'))
    for (const header of ['Código', 'Aluno', 'Contratante', 'Curso', 'Vendedor', 'Valor', 'Status', 'Criado em']) {
      expect(table.getByText(header)).toBeTruthy()
    }
    expect(table.getByText('Carlos Vendedor')).toBeTruthy()
  })

  it('paginação Anterior/Próxima mantém alvo de 44px (Fase 6.1)', () => {
    renderContractsPage([makeContract()], CONTRACT_PAGE_SIZE + 1)

    const anterior = screen.getByRole('button', { name: 'Anterior' })
    const proxima = screen.getByRole('button', { name: 'Próxima' })
    expect(anterior.className).toContain('min-h-11')
    expect(proxima.className).toContain('min-h-11')
    expect(anterior).toBeDisabled()
  })
})

describe('ContractsPage — persistência de filtros na URL (Fase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.view_all'], profile: null, user: null, signOut: vi.fn() })
  })

  it('URL inicial popula filtros e página', () => {
    renderContractsPage([makeContract()], 30, ['/contratos?status=SIGNED&page=2'])
    expect(lastContractListCall().status).toBe('SIGNED')
    expect(lastContractListCall().page).toBe(2)
    expect(screen.getByText('Assinados').className).toContain('bg-navy')
  })

  it('alterar filtro atualiza a URL', async () => {
    const user = userEvent.setup()
    renderContractsPage([makeContract()], 30)
    await user.click(screen.getByRole('button', { name: 'Rascunhos' }))
    await waitFor(() => {
      expect(lastContractListCall().status).toBe('DRAFT')
    })
    expect(screen.getByTestId('location-search').textContent).toContain('status=DRAFT')
  })

  it('alterar filtro reseta page para 1', async () => {
    const user = userEvent.setup()
    renderContractsPage([makeContract()], 30, ['/contratos?status=SIGNED&page=3'])
    await user.click(screen.getByRole('button', { name: 'Todos' }))
    await waitFor(() => {
      expect(lastContractListCall().page).toBe(1)
    })
    expect(screen.getByTestId('location-search').textContent).not.toMatch(/page=/)
  })

  it('page inválida ou negativa cai para 1', () => {
    renderContractsPage([makeContract()], 30, ['/contratos?page=abc'])
    expect(lastContractListCall().page).toBe(1)

    useContractListMock.mockClear()
    renderContractsPage([makeContract()], 30, ['/contratos?page=-3'])
    expect(lastContractListCall().page).toBe(1)
  })

  it('limpar filtro remove o parâmetro da URL', async () => {
    const user = userEvent.setup()
    renderContractsPage([makeContract()])
    await user.type(screen.getByPlaceholderText('Buscar por código, aluno ou contratante...'), 'Ana')
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('q=Ana')
    })

    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(screen.getByTestId('location-search').textContent).not.toMatch(/q=/)
  })

  it('retorno do detalhe preserva contexto', async () => {
    const user = userEvent.setup()
    renderContractsPage([makeContract()], 30, ['/contratos?status=SIGNED&page=2'])

    await user.click(screen.getAllByRole('button', { name: 'Ver contrato' })[0]!)
    expect(await screen.findByText('Detalhe do contrato c1')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByText(/Detalhe do contrato c1/)).toBeNull()
    await waitFor(() => {
      expect(lastContractListCall().status).toBe('SIGNED')
      expect(lastContractListCall().page).toBe(2)
    })
  })
})

describe('ContractsPage — paginação responsiva em 320px (Fase 11.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.view_all'], profile: null, user: null, signOut: vi.fn() })
  })

  it('linha de paginação usa flex-wrap para não cortar Anterior/Próxima', () => {
    renderContractsPage([makeContract()], CONTRACT_PAGE_SIZE + 1)
    const summary = screen.getByText(/página 1 de \d/i)
    const row = summary.closest('div') as HTMLElement
    expect(row.className).toContain('flex-wrap')
    expect(row.className).toContain('gap-y-2')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled()
  })
})

describe('ContractsPage — normalização page > total (Fase 11.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.view_all'], profile: null, user: null, signOut: vi.fn() })
  })

  it('page=999 normaliza para a última página válida', async () => {
    renderContractsPage([makeContract()], 26, ['/contratos?page=999'])

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('page=2')
    })
    expect(lastContractListCall().page).toBe(2)
  })
})