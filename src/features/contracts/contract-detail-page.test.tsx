import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ContractDetailPage } from './contract-detail-page'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['contracts.view', 'contracts.view_all'] as string[]
})))
const detailMock = vi.hoisted(() => vi.fn())
const timelineMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('./contracts-hooks', () => ({
  useContractDetail: () => detailMock(),
  useContractTimeline: () => timelineMock()
}))

vi.mock('./edit-contract-dialog', () => ({ EditContractDialog: () => null }))
vi.mock('./issue-contract-dialog', () => ({ IssueContractDialog: () => null }))
vi.mock('./sign-contract-dialog', () => ({ SignContractDialog: () => null }))
vi.mock('./cancel-contract-dialog', () => ({ CancelContractDialog: () => null }))

const contract = {
  contract_id: 'c1',
  contract_code: 'CON-2026-000001',
  status: 'DRAFT',
  sale_id: 's1',
  sale_code: 'VND-2026-000001',
  sale_status: 'CONFIRMED',
  seller_user_id: 'u1',
  seller_name: 'Carlos',
  course_id: 'cr1',
  student_id: 'st1',
  student_code: 'ALU-2026-0001',
  student_name: 'Ana Souza',
  contractor_person_id: 'p1',
  contractor_name: 'Maria Lima',
  contractor_cpf: null,
  contractor_phone: null,
  contractor_email: null,
  contractor_address: null,
  course_name_snapshot: 'Enfermagem',
  course_workload_snapshot: null,
  course_modality_snapshot: 'PRESENCIAL',
  gross_value_snapshot: 2000,
  discount_value_snapshot: 200,
  net_value_snapshot: 1800,
  payment_method_snapshot: 'CREDIT_CARD',
  installments_snapshot: 12,
  commercial_notes_snapshot: null,
  contract_notes: null,
  created_at: '2026-09-05T10:00:00.000Z',
  issued_at: null,
  signed_at: null,
  canceled_at: null,
  cancellation_reason: null,
  canceled_by_name: null,
  sensitive: false
}

function renderPage(status: string = 'DRAFT') {
  detailMock.mockReturnValue({ data: { ...contract, status }, isLoading: false, isError: false })
  timelineMock.mockReturnValue({ data: { data: [], total: 0 }, isLoading: false, isError: false })
  return render(
    <MemoryRouter initialEntries={['/contratos/c1']}>
      <Routes>
        <Route path="/contratos/:id" element={<ContractDetailPage />} />
        <Route path="/contratos" element={<div>Contracts list page test</div>} />
        <Route path="/vendas/:id" element={<div>Sale detail page test</div>} />
        <Route path="/alunos/:id" element={<div>Aluno detail page test</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ContractDetailPage — touch targets (Fase 6.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.view_all'] })
  })

  it('Ver venda mantém 44px e navega para a venda', async () => {
    const user = userEvent.setup()
    renderPage()

    const ver = screen.getByRole('button', { name: /ver venda/i })
    expect(ver.className).toContain('min-h-11')

    await user.click(ver)
    expect(await screen.findByText('Sale detail page test')).toBeInTheDocument()
  })
})

describe('ContractDetailPage — continuidade E2E (Fase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.view_all'] })
  })

  it('breadcrumb mostra contexto (Contratos > código) e navega para a lista', async () => {
    const user = userEvent.setup()
    renderPage()
    const nav = screen.getByRole('navigation', { name: 'Navegação estrutural' })
    expect(nav).toHaveTextContent('Contratos')
    expect(nav).toHaveTextContent('CON-2026-000001')
    await user.click(screen.getByRole('button', { name: 'Contratos' }))
    expect(await screen.findByText('Contracts list page test')).toBeInTheDocument()
  })

  it('Ver aluno aparece e navega para o aluno relacionado', async () => {
    const user = userEvent.setup()
    renderPage()
    const ver = screen.getByRole('button', { name: /ver aluno/i })
    expect(ver.className).toContain('min-h-11')
    await user.click(ver)
    expect(await screen.findByText('Aluno detail page test')).toBeInTheDocument()
  })

  it('Contrato SIGNED destaca Ver aluno e não mostra ações de mutação duplicadas', () => {
    renderPage('SIGNED')
    const ver = screen.getByRole('button', { name: /ver aluno/i })
    expect(ver.className).toContain('min-h-11')
    expect(ver.className).not.toContain('bg-navy-50')
    expect(screen.queryByRole('button', { name: /emitir contrato/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /registrar assinatura/i })).toBeNull()
    expect(screen.getAllByRole('button', { name: /ver aluno/i })).toHaveLength(1)
  })

  it('Contrato DRAFT não perde o CTA e mantém Ver aluno secundário', async () => {
    const user = userEvent.setup()
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.issue', 'contracts.view_all'] })
    renderPage('DRAFT')
    const emitir = screen.getByRole('button', { name: /emitir contrato/i })
    expect(emitir.className).toContain('min-h-11')
    const ver = screen.getByRole('button', { name: /ver aluno/i })
    await user.click(ver)
    expect(await screen.findByText('Aluno detail page test')).toBeInTheDocument()
  })

  it('Contrato DRAFT mostra editar e emitir quando ambas as permissões existem', () => {
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.edit_draft', 'contracts.issue', 'contracts.view_all'] })
    renderPage('DRAFT')

    expect(screen.getByRole('button', { name: /editar rascunho/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /emitir contrato/i })).toBeInTheDocument()
  })

  it('Contrato DRAFT mostra emitir sem exigir editar rascunho', () => {
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.issue', 'contracts.view_all'] })
    renderPage('DRAFT')

    expect(screen.getByRole('button', { name: /emitir contrato/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar rascunho/i })).toBeNull()
  })

  it('Contrato DRAFT mostra editar sem emitir quando issue não é permitido', () => {
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.edit_draft', 'contracts.view_all'] })
    renderPage('DRAFT')

    expect(screen.getByRole('button', { name: /editar rascunho/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /emitir contrato/i })).toBeNull()
  })

  it('Contrato DRAFT respeita a permissão de cancelamento', () => {
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.cancel', 'contracts.view_all'] })
    renderPage('DRAFT')

    expect(screen.getByRole('button', { name: /cancelar contrato/i })).toBeInTheDocument()
  })

  it('Contrato PENDING_SIGNATURE mostra assinatura e cancelamento, sem ações de DRAFT', () => {
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.edit_draft', 'contracts.issue', 'contracts.mark_signed', 'contracts.cancel', 'contracts.view_all'] })
    renderPage('PENDING_SIGNATURE')

    expect(screen.getByRole('button', { name: /registrar assinatura/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancelar contrato/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar rascunho/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /emitir contrato/i })).toBeNull()
  })

  it.each(['SIGNED', 'CANCELED'])('Contrato %s não mostra ações de mutação', (status) => {
    useAuthMock.mockReturnValue({ permissions: ['contracts.view', 'contracts.edit_draft', 'contracts.issue', 'contracts.mark_signed', 'contracts.cancel', 'contracts.view_all'] })
    renderPage(status)

    expect(screen.queryByRole('button', { name: /editar rascunho/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /emitir contrato/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /registrar assinatura/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /cancelar contrato/i })).toBeNull()
  })
})
