import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { ContractCreateWizard } from './contract-create-wizard'
import type { SaleDetail } from '../sales/sales-types'
import type { ContractorDetail, CreateContractResult } from './contracts-types'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['contracts.create', 'people.create', 'guardians.view'],
  profile: null,
  user: null,
  signOut: vi.fn()
})))

const createContractMutation = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false
}))

const contractorDetailMock = vi.hoisted(() => vi.fn())
const searchContractorPeopleMock = vi.hoisted(() => vi.fn())
const createPersonMock = vi.hoisted(() => vi.fn())
const updatePersonMock = vi.hoisted(() => vi.fn())
const studentGuardiansMock = vi.hoisted(() => vi.fn())
const cepLookupMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('@/features/contracts/contracts-hooks', () => ({
  useCreateContractFromSale: () => createContractMutation,
  useContractorDetail: (personId: unknown) => contractorDetailMock(personId),
  useSearchContractorPeople: (query: unknown) => searchContractorPeopleMock(query),
  useCreatePerson: () => ({ mutateAsync: createPersonMock }),
  useUpdatePerson: () => ({ mutateAsync: updatePersonMock })
}))

vi.mock('@/features/students/students-hooks', () => ({
  useStudentGuardians: (studentId: unknown) => studentGuardiansMock(studentId)
}))

vi.mock('@/features/contracts/use-cep-lookup', () => ({
  useCepLookup: () => cepLookupMock()
}))

const LONG_STREET = 'Rua David da Costa Merchioratto Junior de Andrade Barbosa Sobrinho Filho, Lote 12 Quadra 07 Condominio Residencial Santa Helena Jardim das Flores'
const LONG_EMAIL = 'maria.souza.porto.alegre.ribeirao.preto.amparo.centro@empresaexemplo.com.br'

const detailFixture: ContractorDetail = {
  person_id: 'p1',
  full_name: 'Maria Souza',
  preferred_name: null,
  sensitive: false,
  cpf: '12345678901',
  rg: null,
  birth_date: null,
  email: LONG_EMAIL,
  phone: '(11) 99999-1234',
  whatsapp: null,
  postal_code: '01001-000',
  street: LONG_STREET,
  number: '1420',
  complement: null,
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP'
}

function makeSale(): SaleDetail {
  return {
    id: 'sale-1',
    sale_code: 'VEN-2026-000001',
    status: 'CONFIRMED',
    lead_id: 'lead-1',
    lead_code: 'LEAD-2026-0001',
    person_id: 'p1',
    full_name: 'Maria Souza',
    student_id: 'st-1',
    student_code: 'ALU-2026-0001',
    course_id: 'course-1',
    course_name_snapshot: 'Curso de Enfermagem com carga horária ampliada de formação técnica profissionalizante',
    course_price_snapshot: 2400,
    seller_user_id: 'u1',
    seller_name: 'Carlos Vendedor',
    sale_date: '2026-09-10',
    gross_value: 2400,
    discount_value: 600,
    net_value: 1800,
    payment_method: 'CARTAO_CREDITO',
    installments: 12,
    commercial_notes: null,
    canceled_at: null,
    canceled_by: null,
    canceled_by_name: null,
    cancellation_reason: null,
    created_by: 'u1',
    created_by_name: null,
    created_at: '2026-09-10T10:00:00.000Z',
    updated_at: '2026-09-10T10:00:00.000Z',
    contract_id: null,
    contract_code: null,
    contract_status: null
  }
}

function renderWizard(overrides?: { open?: boolean }) {
  const open = overrides?.open ?? true
  const onChangeCalls: boolean[] = []
  const view = render(
    <MemoryRouter initialEntries={['/contratos/wizard']}>
      <Routes>
        <Route
          path="/contratos/wizard"
          element={
            <ContractCreateWizard
              sale={makeSale()}
              open={open}
              onOpenChange={(next) => { onChangeCalls.push(next) }}
            />
          }
        />
        <Route path="/contratos/:id" element={<ContractDetailRoute />} />
      </Routes>
    </MemoryRouter>
  )
  return { ...view, getOnChangeCalls: () => onChangeCalls }
}

function ContractDetailRoute() {
  const { id } = useParams()
  return <div>Detalhe do contrato {id}</div>
}

describe('ContractCreateWizard — responsivo (Fase 2)', () => {
  beforeEach(() => {
    useAuthMock.mockClear()
    createContractMutation.mutateAsync.mockReset()
    contractorDetailMock.mockReset()
    searchContractorPeopleMock.mockReset()
    createPersonMock.mockReset()
    updatePersonMock.mockReset()
    studentGuardiansMock.mockReset()
    cepLookupMock.mockReset()
    useAuthMock.mockImplementation(() => ({
      permissions: ['contracts.create', 'people.create', 'guardians.view'],
      profile: null,
      user: null,
      signOut: vi.fn()
    }))
    contractorDetailMock.mockReturnValue({ data: detailFixture, isLoading: false, refetch: vi.fn() })
    searchContractorPeopleMock.mockReturnValue({ data: { data: [] }, isLoading: false })
    studentGuardiansMock.mockReturnValue({ data: [], isLoading: false })
    cepLookupMock.mockReturnValue({ status: 'idle' })
    createContractMutation.mutateAsync.mockResolvedValue({
      contract_id: 'ct-1',
      contract_code: 'CTR-2026-000001',
      status: 'DRAFT'
    } satisfies CreateContractResult)
  })

  it('stepper compacto mostra etapa no mobile mantendo labels completos no DOM', async () => {
    renderWizard()

    await screen.findByRole('button', { name: 'Revisar contrato' })

    const etapas = screen.getAllByLabelText('Etapas')
    const mobile = etapas[0]!
    const desktop = etapas[1]!
    expect(within(mobile).getByText('Etapa 1 de 3')).toBeTruthy()
    expect(within(mobile).getByText('1')).toBeTruthy()
    expect(within(mobile).getByText('2')).toBeTruthy()
    expect(within(mobile).getByText('3')).toBeTruthy()
    expect(mobile.className).toContain('sm:hidden')

    expect(desktop.className).toContain('hidden')
    expect(within(desktop).getByText('Contratante')).toBeTruthy()
    expect(within(desktop).getByText('Revisão')).toBeTruthy()
    expect(within(desktop).getByText('Resultado')).toBeTruthy()
  })

  it('endereço e contato longos quebram linha sem truncar na revisão', async () => {
    const user = userEvent.setup()
    renderWizard()

    await screen.findByRole('button', { name: 'Revisar contrato' })
    await user.click(screen.getByRole('button', { name: 'Revisar contrato' }))

    const address = await screen.findByText((content) => content.includes('Rua David da Costa'))
    expect(address.className).toContain('break-words')
    expect(address.className).not.toContain('truncate')

    const contact = screen.getByText((content) => content.includes('maria.souza.porto.alegre'))
    expect(contact.className).not.toContain('truncate')
  })

  it('fluxo principal continua funcional: revisar → criar rascunho → ver contrato', async () => {
    const user = userEvent.setup()
    const { getOnChangeCalls } = renderWizard()

    await screen.findByRole('button', { name: 'Revisar contrato' })
    expect(screen.getByRole('button', { name: 'Revisar contrato' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Revisar contrato' }))
    expect(screen.getByText('Criar contrato em rascunho')).toBeTruthy()
    expect(screen.getByText('Valor líquido')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Criar contrato em rascunho' }))
    await waitFor(() => {
      expect(createContractMutation.mutateAsync).toHaveBeenCalledWith({
        sale_id: 'sale-1',
        contractor_person_id: 'p1',
        contract_notes: undefined
      })
    })

    expect(await screen.findByText('Contrato criado')).toBeTruthy()
    expect(screen.getByText('CTR-2026-000001')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Ver contrato' }))
    expect(await screen.findByText('Detalhe do contrato ct-1')).toBeTruthy()
    expect(getOnChangeCalls().some((c) => c === false)).toBe(true)
  })

  it('fechar pelo botão Cancelar fecha o modal e reseta para a etapa 1', async () => {
    const user = userEvent.setup()
    const { getOnChangeCalls } = renderWizard()

    await screen.findByRole('button', { name: 'Revisar contrato' })
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(getOnChangeCalls()).toContain(false)
  })
})