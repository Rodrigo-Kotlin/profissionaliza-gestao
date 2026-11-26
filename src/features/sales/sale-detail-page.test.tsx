import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SaleDetailPage } from './sale-detail-page'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['sales.view', 'sales.cancel', 'contracts.create'] as string[],
  user: { id: 'user-1' }
})))
const detailMock = vi.hoisted(() => vi.fn())
const timelineMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('./sales-hooks', () => ({
  useSaleDetail: () => detailMock(),
  useSaleTimeline: () => timelineMock()
}))

vi.mock('./cancel-sale-dialog', () => ({
  CancelSaleDialog: () => <div data-testid="cancel-dialog" />
}))

vi.mock('../contracts/contract-create-wizard', () => ({
  ContractCreateWizard: () => <div data-testid="contract-wizard" />
}))

const baseSale = {
  id: 's1',
  sale_code: 'VND-2026-000001',
  status: 'CONFIRMED',
  sale_date: '2026-09-01',
  full_name: 'Ana Souza',
  student_id: 'stu-1',
  student_code: 'ALU-2026-0001',
  course_name_snapshot: 'Enfermagem',
  course_price_snapshot: 2000,
  payment_method: 'CREDIT_CARD',
  installments: 12,
  seller_name: 'Carlos',
  created_by_name: 'Carlos',
  seller_user_id: 'user-1',
  lead_id: 'lead-1',
  lead_code: 'CRM-0001',
  contract_id: null,
  contract_code: null,
  contract_status: null,
  net_value: 1800,
  gross_value: 2000,
  discount_value: 200,
  commercial_notes: null,
  cancellation_reason: null,
  canceled_by_name: null,
  canceled_at: null
}

function renderPage(saleWithOverrides: Record<string, unknown> = {}) {
  detailMock.mockReturnValue({ data: { ...baseSale, ...saleWithOverrides }, isLoading: false, isError: false })
  timelineMock.mockReturnValue({ data: { data: [], total: 0 }, isLoading: false, isError: false })
  return render(
    <MemoryRouter initialEntries={['/vendas/s1']}>
      <Routes>
        <Route path="/vendas/:id" element={<SaleDetailPage />} />
        <Route path="/vendas" element={<div>Vendas list page test</div>} />
        <Route path="/crm/leads/:id" element={<div>Lead detail page test</div>} />
        <Route path="/contratos/:id" element={<div>Contract detail page test</div>} />
        <Route path="/alunos/:id" element={<div>Aluno detail page test</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SaleDetailPage — touch targets (Fase 6.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      permissions: ['sales.view', 'sales.cancel', 'contracts.create'],
      user: { id: 'user-1' }
    })
  })

  it('Gerar contrato mantém 44px e abre o wizard', async () => {
    const user = userEvent.setup()
    renderPage()
    const gerar = screen.getAllByRole('button', { name: /gerar contrato/i })
    for (const button of gerar) {
      expect(button.className).toContain('min-h-11')
    }
    await user.click(gerar[0]!)
    expect(screen.getByTestId('contract-wizard')).toBeInTheDocument()
  })

  it('Ver contrato mantém 44px e navega quando venda possui contrato', async () => {
    const user = userEvent.setup()
    renderPage({ contract_id: 'c1', contract_code: 'CON-2026-000001', contract_status: 'DRAFT' })
    const ver = screen.getByRole('button', { name: /ver contrato/i })
    expect(ver.className).toContain('min-h-11')
    await user.click(ver)
    expect(await screen.findByText('Contract detail page test')).toBeInTheDocument()
  })

  it('Ver lead mantém 44px e navega para o CRM', async () => {
    const user = userEvent.setup()
    renderPage()
    const ver = screen.getByRole('button', { name: /ver lead/i })
    expect(ver.className).toContain('min-h-11')
    await user.click(ver)
    expect(await screen.findByText('Lead detail page test')).toBeInTheDocument()
  })
})

describe('SaleDetailPage — continuidade E2E (Fase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      permissions: ['sales.view', 'sales.cancel', 'contracts.create'],
      user: { id: 'user-1' }
    })
  })

  it('breadcrumb mostra contexto (Vendas > código) e navega para a lista', async () => {
    const user = userEvent.setup()
    renderPage()
    const nav = screen.getByRole('navigation', { name: 'Navegação estrutural' })
    expect(nav).toHaveTextContent('Vendas')
    expect(nav).toHaveTextContent('VND-2026-000001')
    await user.click(screen.getByRole('button', { name: 'Vendas' }))
    expect(await screen.findByText('Vendas list page test')).toBeInTheDocument()
  })

  it('Ver aluno aparece e navega para o aluno relacionado', async () => {
    const user = userEvent.setup()
    renderPage()
    const ver = screen.getByRole('button', { name: /ver aluno/i })
    expect(ver.className).toContain('min-h-11')
    await user.click(ver)
    expect(await screen.findByText('Aluno detail page test')).toBeInTheDocument()
  })

  it('não duplica a ação Gerar contrato quando a venda não possui contrato', () => {
    renderPage()
    const gerar = screen.getAllByRole('button', { name: /gerar contrato/i })
    expect(gerar).toHaveLength(1)
  })
})

describe('SaleDetailPage — read model normalizado (Fase 2.8A.6.4.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      permissions: ['sales.view', 'sales.cancel', 'contracts.create'],
      user: { id: 'user-1' }
    })
  })

  it('apresenta cursos simulados com snapshots, carga horária e modalidade', () => {
    const item = (id: string, position: number, courseId: string, name: string) => ({
      id,
      sale_id: 's1',
      position,
      course_id: courseId,
      offer_item_id: null,
      course_code_snapshot: `CUR-${position}`,
      course_name_snapshot: name,
      course_workload_snapshot: 120,
      course_modality_snapshot: 'ONLINE' as const,
      created_at: '2026-10-28T10:00:00.000Z'
    })

    renderPage({
      item_count: 2,
      items: [item('item-2', 2, 'course-2', 'Curso B'), item('item-1', 1, 'course-1', 'Curso A')],
      item_count_matches_items: true,
      course_display_mode: 'MULTIPLE',
      course_summary: '2 cursos',
      offer_type_snapshot: 'ONLINE_CATALOG'
    })

    expect(screen.getByText('Cursos')).toBeTruthy()
    expect(screen.getByText('2 cursos')).toBeTruthy()
    expect(screen.getByText('Tipo comercial: Catálogo online')).toBeTruthy()
    expect(screen.getByText('1. Curso A')).toBeTruthy()
    expect(screen.getByText('2. Curso B')).toBeTruthy()
    expect(screen.getAllByText('CUR-1 · 120h · ONLINE')).toHaveLength(1)
    expect(screen.getAllByText('CUR-2 · 120h · ONLINE')).toHaveLength(1)
  })

  it('sinaliza divergência de cardinalidade no detalhe', () => {
    renderPage({
      item_count: 3,
      items: [],
      item_count_matches_items: false,
      course_display_mode: 'MULTIPLE'
    })

    expect(screen.getByText(/Divergência entre a quantidade informada/)).toBeTruthy()
  })
})