import { describe, it, expect, vi, beforeEach } from 'vitest'
import { contractsService } from './contracts-service'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock }
}))

const contractResult = { contract_id: 'ct-1', contract_code: 'CTR-2026-000001', status: 'DRAFT' }

describe('contractsService.createFromSale', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls create_contract_from_sale with sale, contractor and notes', async () => {
    rpcMock.mockResolvedValue({ data: contractResult, error: null })
    const result = await contractsService.createFromSale({
      sale_id: 'sale-1',
      contractor_person_id: 'person-1',
      contract_notes: 'Observação'
    })
    expect(rpcMock).toHaveBeenCalledWith('create_contract_from_sale', {
      p_sale_id: 'sale-1',
      p_contractor_person_id: 'person-1',
      p_contract_notes: 'Observação'
    })
    expect(result.contract_code).toBe('CTR-2026-000001')
  })

  it('omits empty contract_notes', async () => {
    rpcMock.mockResolvedValue({ data: contractResult, error: null })
    await contractsService.createFromSale({ sale_id: 'sale-1', contractor_person_id: 'person-1' })
    expect(rpcMock).toHaveBeenCalledWith('create_contract_from_sale', {
      p_sale_id: 'sale-1',
      p_contractor_person_id: 'person-1',
      p_contract_notes: undefined
    })
  })

  it('throws on RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Contract already exists for this sale' } })
    await expect(contractsService.createFromSale({
      sale_id: 'sale-1',
      contractor_person_id: 'person-1'
    })).rejects.toThrow()
  })
})

describe('contractsService.updateDraft / issue / sign / cancel', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls update_contract_draft', async () => {
    rpcMock.mockResolvedValue({ data: contractResult, error: null })
    await contractsService.updateDraft({ contract_id: 'ct-1', contractor_person_id: 'person-2', contract_notes: 'nova nota' })
    expect(rpcMock).toHaveBeenCalledWith('update_contract_draft', {
      p_contract_id: 'ct-1',
      p_contractor_person_id: 'person-2',
      p_contract_notes: 'nova nota'
    })
  })

  it('calls issue_contract', async () => {
    rpcMock.mockResolvedValue({ data: { ...contractResult, status: 'PENDING_SIGNATURE' }, error: null })
    await contractsService.issue('ct-1')
    expect(rpcMock).toHaveBeenCalledWith('issue_contract', { p_contract_id: 'ct-1' })
  })

  it('calls mark_contract_signed', async () => {
    rpcMock.mockResolvedValue({ data: { ...contractResult, status: 'SIGNED' }, error: null })
    await contractsService.sign('ct-1')
    expect(rpcMock).toHaveBeenCalledWith('mark_contract_signed', { p_contract_id: 'ct-1' })
  })

  it('calls cancel_contract with reason', async () => {
    rpcMock.mockResolvedValue({ data: { ...contractResult, status: 'CANCELED' }, error: null })
    await contractsService.cancel({ contract_id: 'ct-1', cancellation_reason: 'Motivo' })
    expect(rpcMock).toHaveBeenCalledWith('cancel_contract', { p_contract_id: 'ct-1', p_reason: 'Motivo' })
  })
})

describe('contractsService.list', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls list_contracts with default parameters', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, page_size: 25 }, error: null })
    await contractsService.list({})
    expect(rpcMock).toHaveBeenCalledWith('list_contracts', {
      p_search: undefined,
      p_status: undefined,
      p_seller_user_id: undefined,
      p_course_id: undefined,
      p_date_from: undefined,
      p_date_to: undefined,
      p_page: 1,
      p_page_size: 25
    })
  })

  it('passes filters', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, page_size: 25 }, error: null })
    await contractsService.list({
      search: 'CTR-2026',
      status: 'DRAFT',
      seller_user_id: 'user-1',
      course_id: 'course-1',
      date_from: '2026-01-01',
      date_to: '2026-12-31',
      page: 2,
      page_size: 10
    })
    expect(rpcMock).toHaveBeenCalledWith('list_contracts', expect.objectContaining({
      p_search: 'CTR-2026',
      p_status: 'DRAFT',
      p_page: 2,
      p_page_size: 10
    }))
  })
})

describe('contractsService.detail / timeline', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls get_contract_detail with p_contract_id', async () => {
    rpcMock.mockResolvedValue({ data: { contract_id: 'ct-1', contract_code: 'CTR-2026-000001' }, error: null })
    await contractsService.detail('ct-1')
    expect(rpcMock).toHaveBeenCalledWith('get_contract_detail', { p_contract_id: 'ct-1' })
  })

  it('calls get_contract_timeline with p_contract_id', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0 }, error: null })
    const result = await contractsService.timeline('ct-1')
    expect(rpcMock).toHaveBeenCalledWith('get_contract_timeline', { p_contract_id: 'ct-1' })
    expect(result.data).toEqual([])
  })
})

describe('contractsService.searchContractorPeople', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls search_contractor_people with query and limit', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0 }, error: null })
    await contractsService.searchContractorPeople({ query: 'Maria', limit: 8 })
    expect(rpcMock).toHaveBeenCalledWith('search_contractor_people', { p_query: 'Maria', p_limit: 8 })
  })

  it('omits empty query', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0 }, error: null })
    await contractsService.searchContractorPeople({})
    expect(rpcMock).toHaveBeenCalledWith('search_contractor_people', { p_query: undefined, p_limit: 8 })
  })
})

describe('contractsService.createPerson', () => {
  beforeEach(() => rpcMock.mockReset())

  it('calls create_person with normalized fields', async () => {
    rpcMock.mockResolvedValue({ data: { person_id: 'person-1', reused: false }, error: null })
    const result = await contractsService.createPerson({
      full_name: '  João  Souza ',
      cpf: '529.982.247-25',
      email: 'JOAO@exemplo.com',
      phone: '(11) 99999-0000',
      state: 'sp'
    })
    expect(rpcMock).toHaveBeenCalledWith('create_person', expect.objectContaining({
      p_full_name: '  João  Souza ',
      p_cpf: '52998224725',
      p_email: 'joao@exemplo.com',
      p_phone: '11999990000',
      p_state: 'SP'
    }))
    expect(result).toEqual({ person_id: 'person-1', reused: false })
  })

  it('sends other optional fields when present', async () => {
    rpcMock.mockResolvedValue({ data: { person_id: 'person-1', reused: false }, error: null })
    await contractsService.createPerson({
      full_name: 'João Souza',
      preferred_name: 'Jo',
      city: 'São Paulo',
postal_code: '13456000'
    })
    expect(rpcMock).toHaveBeenCalledWith('create_person', expect.objectContaining({
      p_preferred_name: 'Jo',
      p_city: 'São Paulo',
      p_postal_code: '13456000',
      p_rg: undefined,
      p_birth_date: undefined
    }))
  })
})