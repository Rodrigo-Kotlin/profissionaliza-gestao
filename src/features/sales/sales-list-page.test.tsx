import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SalesPage } from './sales-list-page'
import type { SaleListItem, SaleListResponse } from './sales-types'
import { SALE_PAGE_SIZE } from './sales-constants'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['sales.view', 'sales.view_all'],
  profile: null,
  user: null,
  signOut: vi.fn()
})))

const useSaleListMock = vi.hoisted(() => vi.fn())
const useCrmCoursesMock = vi.hoisted(() => vi.fn(() => ({ data: [], isLoading: false, isError: false })))

const supabaseFromMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('@/features/sales/sales-hooks', () => ({
  useSaleList: (params: unknown) => useSaleListMock(params)
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

function makeSale(overrides: Partial<SaleListItem> = {}): SaleListItem {
  return {
    id: 'sale-1',
    sale_code: 'VENDA-2026-000001',
    status: 'CONFIRMED',
    lead_id: 'lead-1',
    lead_code: 'LEAD-2026-000001',
    full_name: 'Ana Souza',
    course_name: 'Curso de Enfermagem',
    seller_name: 'Carlos Vendedor',
    sale_date: '2026-09-05T10:00:00.000Z',
    gross_value: 2200,
    discount_value: 200,
    net_value: 2000,
    payment_method: 'PIX',
    installments: 1,
    created_at: '2026-09-05T10:00:00.000Z',
    ...overrides
  }
}

function renderSalesPage(sales: SaleListItem[] = [], total: number = sales.length, initialEntries: string[] = ['/vendas']) {
  const client = queryClient()
  supabaseFromMock.mockReturnValue({
    select: vi.fn(() => ({ order: vi.fn(() => ({ data: [], error: null })) }))
  })
  useSaleListMock.mockReturnValue({
    data: { data: sales, total, page: 1, page_size: SALE_PAGE_SIZE } satisfies SaleListResponse,
    isLoading: false,
    isError: false
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/vendas" element={<><SalesPage /><LocationProbe /></>} />
          <Route path="/vendas/:id" element={<SaleDetailRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function LocationProbe() {
  const [search] = useSearchParams()
  return <span data-testid="location-search">{search.toString()}</span>
}

function SaleDetailRoute() {
  const { id } = useParams()
  const navigate = useNavigate()
  return <div>Detalhe da venda {id} <button onClick={() => navigate(-1)}>Voltar</button></div>
}

const lastSaleListCall = () => useSaleListMock.mock.calls[useSaleListMock.mock.calls.length - 1]?.[0] as Record<string, unknown>

describe('SalesPage — listagem responsiva (Fase 1)', () => {
  beforeEach(() => {
    useAuthMock.mockClear()
    useSaleListMock.mockClear()
    useCrmCoursesMock.mockClear()
    supabaseFromMock.mockClear()
    useAuthMock.mockImplementation(() => ({
      permissions: ['sales.view', 'sales.view_all'],
      profile: null,
      user: null,
      signOut: vi.fn()
    }))
  })

  it('mobileCard existe e mostra as informações essenciais na ordem esperada', () => {
    renderSalesPage([makeSale()])

    const cards = screen.getByRole('list')
    expect(screen.getByRole('listitem', { hidden: false })).toBeTruthy()

    const card = within(cards)
    expect(card.getByText('VENDA-2026-000001')).toBeTruthy()
    expect(card.getByText('Ana Souza')).toBeTruthy()
    expect(card.getByText('Confirmada')).toBeTruthy()
    expect(card.getByText('Curso de Enfermagem')).toBeTruthy()
    expect(card.getByText('R$ 2.000')).toBeTruthy()
    expect(card.getByText('05/09/2026')).toBeTruthy()
    expect(card.queryByText('Carlos Vendedor')).toBeNull()
    expect(card.queryByText('PIX')).toBeNull()
  })

  it('navegação para o detalhe continua funcionando a partir do mobileCard', async () => {
    const user = userEvent.setup()
    renderSalesPage([makeSale()])

    await user.click(screen.getByRole('button', { name: 'Ver venda' }))
    expect(await screen.findByText('Detalhe da venda sale-1')).toBeTruthy()
  })

  it('mantém a tabela desktop com as colunas da lista rica', () => {
    renderSalesPage([makeSale()])

    expect(screen.getByRole('table')).toBeTruthy()
    const table = within(screen.getByRole('table'))
    for (const header of ['Código', 'Cliente', 'Curso', 'Vendedor', 'Valor', 'Pagamento', 'Status', 'Data']) {
      expect(table.getByText(header)).toBeTruthy()
    }
    expect(table.getByText('VENDA-2026-000001')).toBeTruthy()
    expect(table.getByText('Carlos Vendedor')).toBeTruthy()
  })

  it('botão limpar busca possui nome acessível e limpa o filtro', async () => {
    const user = userEvent.setup()
    renderSalesPage()

    const searchInput = screen.getByPlaceholderText('Buscar por código ou cliente...')
    await user.type(searchInput, 'Ana')

    await waitFor(() => {
      expect(lastSaleListCall().search).toBe('Ana')
    })

    const clearButton = screen.getByRole('button', { name: 'Limpar busca' })
    expect(clearButton).toBeTruthy()
    await user.click(clearButton)

    await waitFor(() => {
      expect(lastSaleListCall().search).toBeUndefined()
    })
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull()
  })

  it('pills de status continuam filtrando (Confirmadas/Canceladas/Todas)', async () => {
    const user = userEvent.setup()
    renderSalesPage([makeSale()])

    await user.click(screen.getByRole('button', { name: 'Confirmadas' }))
    await waitFor(() => {
      expect(lastSaleListCall().status).toBe('CONFIRMED')
    })

    await user.click(screen.getByRole('button', { name: 'Canceladas' }))
    await waitFor(() => {
      expect(lastSaleListCall().status).toBe('CANCELED')
    })

    await user.click(screen.getByRole('button', { name: 'Todas' }))
    await waitFor(() => {
      expect(lastSaleListCall().status).toBeUndefined()
    })
  })

  it('filtro de período continua funcional', async () => {
    const user = userEvent.setup()
    renderSalesPage()

    await user.type(screen.getByLabelText('Data inicial'), '2026-01-01')
    await waitFor(() => {
      expect(lastSaleListCall().date_from).toBe('2026-01-01')
    })

    await user.type(screen.getByLabelText('Data final'), '2026-12-31')
    await waitFor(() => {
      expect(lastSaleListCall().date_to).toBe('2026-12-31')
    })
  })

  it('paginação navega e não provoca overflow (botões anteriores/próxima)', async () => {
    const user = userEvent.setup()
    renderSalesPage([makeSale()], 26)

    const prev = screen.getByRole('button', { name: 'Anterior' })
    const next = screen.getByRole('button', { name: 'Próxima' })
    expect(prev).toBeDisabled()

    await user.click(next)
    await waitFor(() => {
      expect(lastSaleListCall().page).toBe(2)
    })
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    await waitFor(() => {
      expect(lastSaleListCall().page).toBe(1)
    })
  })
})

describe('SalesPage — persistência de filtros na URL (Fase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['sales.view', 'sales.view_all'], profile: null, user: null, signOut: vi.fn() })
  })

  it('URL inicial popula filtros e página', () => {
    renderSalesPage([makeSale()], 30, ['/vendas?status=CONFIRMED&page=2'])

    expect(lastSaleListCall().status).toBe('CONFIRMED')
    expect(lastSaleListCall().page).toBe(2)
    expect(screen.getByText('Confirmadas').className).toContain('bg-navy')
  })

  it('alterar filtro atualiza a URL e reflete na query', async () => {
    const user = userEvent.setup()
    renderSalesPage([makeSale()], 30)

    await user.click(screen.getByRole('button', { name: 'Canceladas' }))

    await waitFor(() => {
      expect(lastSaleListCall().status).toBe('CANCELED')
    })
    expect(screen.getByTestId('location-search').textContent).toContain('status=CANCELED')
  })

  it('alterar filtro reseta page para 1', async () => {
    const user = userEvent.setup()
    renderSalesPage([makeSale()], 30, ['/vendas?status=CONFIRMED&page=3'])

    await user.click(screen.getByRole('button', { name: 'Todas' }))

    await waitFor(() => {
      expect(lastSaleListCall().page).toBe(1)
    })
    expect(screen.getByTestId('location-search').textContent).not.toMatch(/page=/)
  })

  it('page inválida ou negativa cai para 1', () => {
    renderSalesPage([makeSale()], 30, ['/vendas?page=abc'])
    expect(lastSaleListCall().page).toBe(1)

    useSaleListMock.mockClear()
    renderSalesPage([makeSale()], 30, ['/vendas?page=-3'])
    expect(lastSaleListCall().page).toBe(1)
  })

  it('limpar filtro de busca remove o parâmetro da URL', async () => {
    const user = userEvent.setup()
    renderSalesPage([makeSale()])

    await user.type(screen.getByPlaceholderText('Buscar por código ou cliente...'), 'Ana')
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('q=Ana')
    })

    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(screen.getByTestId('location-search').textContent).not.toMatch(/q=/)
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull()
  })

  it('retorno do detalhe preserva filtros e página', async () => {
    const user = userEvent.setup()
    renderSalesPage([makeSale()], 30, ['/vendas?status=CONFIRMED&page=2'])

    await user.click(screen.getByRole('button', { name: 'Ver venda' }))
    expect(await screen.findByText('Detalhe da venda sale-1')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.queryByText(/Detalhe da venda sale-1/)).toBeNull()

    await waitFor(() => {
      expect(lastSaleListCall().status).toBe('CONFIRMED')
      expect(lastSaleListCall().page).toBe(2)
    })
    expect(screen.getByTestId('location-search').textContent).toContain('status=CONFIRMED&page=2')
  })
})

describe('SalesPage — paginação responsiva em 320px (Fase 11.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['sales.view', 'sales.view_all'], profile: null, user: null, signOut: vi.fn() })
  })

  it('linha de paginação usa flex-wrap para não cortar Anterior/Próxima', () => {
    renderSalesPage([makeSale()], 26)
    const summary = screen.getByText(/página 1 de 2/i)
    const row = summary.closest('div') as HTMLElement
    expect(row.className).toContain('flex-wrap')
    expect(row.className).toContain('gap-y-2')
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeEnabled()
  })
})

describe('SalesPage — normalização page > total (Fase 11.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['sales.view', 'sales.view_all'], profile: null, user: null, signOut: vi.fn() })
  })

  it('page=999 normaliza para a última página válida e não entra em loop', async () => {
    renderSalesPage([makeSale()], 26, ['/vendas?page=999'])

    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('page=2')
    })
    expect(lastSaleListCall().page).toBe(2)
    expect(useSaleListMock.mock.calls.length).toBe(2)
  })
})