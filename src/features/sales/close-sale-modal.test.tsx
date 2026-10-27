import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { CloseSaleModal } from './close-sale-modal'
import { OFFLINE_MESSAGE } from '@/lib/offline'
import type { CrmLeadDetail } from '../crm/crm-types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const rpcMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const baseLead: CrmLeadDetail = {
  id: 'lead-1', lead_code: 'LEAD-2026-000001', person_id: 'person-1', full_name: 'Maria Silva',
  phone: null, whatsapp: null, email: null, stage_id: 'stage-1', stage_code: 'NEGOTIATION', stage_name: 'Negociação',
  source_id: null, source_name: null, course_interest_id: 'course-1', course_name: 'Administração', owner_user_id: 'user-1', owner_name: 'João',
  status: 'OPEN', temperature: 'HOT', qualification_start_period: null, preferred_shift: null, preferred_modality: null,
  budget_notes: null, decision_maker: null, source_detail: null, utm_source: null, utm_medium: null, utm_campaign: null,
  estimated_value: 1500, proposed_value: 1200, proposal_sent_at: null, commercial_notes: null, lost_reason_id: null,
  lost_reason_name: null, lost_notes: null, created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
  closed_at: null, days_in_pipeline: 30, sale_id: null, sale_code: null, sale_status: null, sale_net_value: null, sale_created_at: null, next_activity: null
}

const offer = { id: 'offer-1', code: 'OFR-COURSE-1', name: 'Administração regular', course_id: 'course-1', offer_type: 'COURSE', status: 'ACTIVE', valid_from: '2026-01-01', valid_until: null, created_at: '', created_by: null, updated_at: '', updated_by: null }
const plan = { id: 'plan-1', code: 'PLAN-PIX-1', offer_id: 'offer-1', payment_method: 'PIX', pricing_model: 'CASH', cash_price: 2000, enrollment_fee: 0, installment_count: null, installment_amount: null, total_amount: 2000, quantity_min: null, quantity_max: null, status: 'ACTIVE', valid_from: '2026-01-01', valid_until: null, created_at: '', created_by: null, updated_at: '', updated_by: null }

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
}

async function renderToConfirm() {
  const user = userEvent.setup()
  render(<CloseSaleModal lead={baseLead} open={true} onOpenChange={vi.fn()} />, { wrapper })
  await waitFor(() => expect(screen.getByRole('option', { name: offer.name })).toBeInTheDocument())
  const selects = screen.getAllByRole('combobox')
  await user.selectOptions(selects[0]!, offer.id)
  await waitFor(() => expect(screen.getByRole('option', { name: /À vista/ })).toBeInTheDocument())
  await user.selectOptions(screen.getAllByRole('combobox')[1]!, plan.id)
  await user.click(screen.getByText('Revisar venda'))
  await waitFor(() => expect(screen.getByText('Confirmar venda')).toBeInTheDocument())
  return user
}

describe('CloseSaleModal — commercial COURSE flow', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'list_course_offers') return Promise.resolve({ data: [offer], error: null })
      if (fn === 'list_price_plans') return Promise.resolve({ data: [plan], error: null })
      if (fn === 'create_sale_from_commercial_offer') return Promise.resolve({ data: { sale_id: 'sale-1', sale_code: 'VND-2026-000001' }, error: null })
      return Promise.resolve({ data: [], error: null })
    })
  })

  it('renders only commercial selectors and no free commercial inputs', async () => {
    render(<CloseSaleModal lead={{ ...baseLead, course_interest_id: null }} open={true} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.getByText('Fechar venda')).toBeInTheDocument()
    expect(screen.getByText('Oferta COURSE *')).toBeInTheDocument()
    expect(screen.queryByText('Valor bruto *')).not.toBeInTheDocument()
    expect(screen.queryByText('Parcelas *')).not.toBeInTheDocument()
  })

  it('requires offer and price plan', async () => {
    const user = userEvent.setup()
    render(<CloseSaleModal lead={{ ...baseLead, course_interest_id: null }} open={true} onOpenChange={vi.fn()} />, { wrapper })
    await user.click(screen.getByText('Revisar venda'))
    expect(await screen.findByText('Oferta obrigatória')).toBeInTheDocument()
    expect(screen.getByText('Plano de preço obrigatório')).toBeInTheDocument()
  })

  it('does not render while closed', () => {
    render(<CloseSaleModal lead={baseLead} open={false} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Fechar venda')).not.toBeInTheDocument()
  })

  it('reviews derived values and calls the new RPC without free-value parameters', async () => {
    const user = await renderToConfirm()
    expect(screen.getByText('Administração regular')).toBeInTheDocument()
    expect(screen.getAllByText(/R\$.*2\.000/).length).toBeGreaterThan(0)
    await user.click(screen.getByText('Confirmar venda'))
    await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('create_sale_from_commercial_offer', expect.objectContaining({
      p_lead_id: 'lead-1', p_offer_id: 'offer-1', p_price_plan_id: 'plan-1'
    })))
    const args = rpcMock.mock.calls.find(([fn]) => fn === 'create_sale_from_commercial_offer')?.[1]
    expect(args).not.toHaveProperty('p_gross_value')
    expect(args).not.toHaveProperty('p_payment_method')
    expect(args).not.toHaveProperty('p_installments')
  })

  it('returns from review to the commercial form', async () => {
    const user = await renderToConfirm()
    await user.click(screen.getByText('Voltar'))
    expect(screen.getByText('Revisar venda')).toBeInTheDocument()
  })

  it('shows customer and seller in the review', async () => {
    await renderToConfirm()
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText('João')).toBeInTheDocument()
  })

  it('keeps review rows safe for long content', async () => {
    await renderToConfirm()
    const value = screen.getByText('Maria Silva')
    expect(value.className).toContain('min-w-0')
    expect(value.className).toContain('break-words')
    expect(value.className).not.toContain('truncate')
  })

  it('uses the commercial RPC and preserves offline feedback', async () => {
    const errorSpy = vi.spyOn(toast, 'error')
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'list_course_offers') return Promise.resolve({ data: [offer], error: null })
      if (fn === 'list_price_plans') return Promise.resolve({ data: [plan], error: null })
      return Promise.reject(new TypeError('Failed to fetch'))
    })
    await (async () => { const user = await renderToConfirm(); await user.click(screen.getByText('Confirmar venda')) })()
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(OFFLINE_MESSAGE))
  })

  it('does not mask an RPC permission error as offline', async () => {
    const errorSpy = vi.spyOn(toast, 'error')
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'list_course_offers') return Promise.resolve({ data: [offer], error: null })
      if (fn === 'list_price_plans') return Promise.resolve({ data: [plan], error: null })
      const error = Object.assign(new Error('permission denied'), { code: '42501' })
      return Promise.reject(error)
    })
    const user = await renderToConfirm()
    await user.click(screen.getByText('Confirmar venda'))
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Não foi possível criar a venda.'))
    expect(errorSpy).not.toHaveBeenCalledWith(OFFLINE_MESSAGE)
  })
})
