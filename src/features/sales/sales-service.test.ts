import { describe, it, expect, vi, beforeEach } from 'vitest'
import { salesService } from './sales-service'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock
  }
}))

describe('salesService.createFromLead', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('calls create_sale_from_lead with correct parameters', async () => {
    rpcMock.mockResolvedValue({ data: { sale_id: 'sale-1', sale_code: 'VND-2026-000001' }, error: null })
    const result = await salesService.createFromLead({
      lead_id: 'lead-1',
      course_id: 'course-1',
      gross_value: 1500,
      discount_value: 0,
      payment_method: 'PIX',
      installments: 1
    })
    expect(rpcMock).toHaveBeenCalledWith('create_sale_from_lead', {
      p_lead_id: 'lead-1',
      p_course_id: 'course-1',
      p_gross_value: 1500,
      p_discount_value: 0,
      p_payment_method: 'PIX',
      p_installments: 1,
      p_commercial_notes: undefined
    })
    expect(result.sale_id).toBe('sale-1')
    expect(result.sale_code).toBe('VND-2026-000001')
  })

  it('sends commercial_notes when provided', async () => {
    rpcMock.mockResolvedValue({ data: { sale_id: 'sale-2', sale_code: 'VND-2026-000002' }, error: null })
    await salesService.createFromLead({
      lead_id: 'lead-1',
      course_id: 'course-1',
      gross_value: 2000,
      discount_value: 100,
      payment_method: 'BOLETO',
      installments: 3,
      commercial_notes: 'Teste'
    })
    expect(rpcMock).toHaveBeenCalledWith('create_sale_from_lead', expect.objectContaining({
      p_commercial_notes: 'Teste'
    }))
  })

  it('throws on RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Lead is not open' } })
    await expect(salesService.createFromLead({
      lead_id: 'lead-1',
      course_id: 'course-1',
      gross_value: 1500,
      discount_value: 0,
      payment_method: 'PIX',
      installments: 1
    })).rejects.toThrow()
  })
})

describe('salesService.listSales', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('calls list_sales with default parameters', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, page_size: 25 }, error: null })
    await salesService.listSales({})
    expect(rpcMock).toHaveBeenCalledWith('list_sales', {
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

  it('passes search and filters', async () => {
    rpcMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, page_size: 25 }, error: null })
    await salesService.listSales({
      search: 'VND-2026',
      status: 'CONFIRMED',
      seller_user_id: 'user-1',
      course_id: 'course-1',
      date_from: '2026-01-01',
      date_to: '2026-12-31',
      page: 2,
      page_size: 10
    })
    expect(rpcMock).toHaveBeenCalledWith('list_sales', {
      p_search: 'VND-2026',
      p_status: 'CONFIRMED',
      p_seller_user_id: 'user-1',
      p_course_id: 'course-1',
      p_date_from: '2026-01-01',
      p_date_to: '2026-12-31',
      p_page: 2,
      p_page_size: 10
    })
  })
})

describe('salesService.getSaleDetail', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('calls get_sale_detail with p_sale_id', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'sale-1', sale_code: 'VND-2026-000001' }, error: null })
    await salesService.getSaleDetail('sale-1')
    expect(rpcMock).toHaveBeenCalledWith('get_sale_detail', { p_sale_id: 'sale-1' })
  })
})

describe('salesService.cancelSale', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('calls cancel_sale with correct parameters', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await salesService.cancelSale('sale-1', 'Cliente desistiu')
    expect(rpcMock).toHaveBeenCalledWith('cancel_sale', {
      p_sale_id: 'sale-1',
      p_cancellation_reason: 'Cliente desistiu'
    })
  })

  it('throws on RPC error', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Only confirmed sales can be canceled' } })
    await expect(salesService.cancelSale('sale-1', 'Reason')).rejects.toThrow()
  })
})
