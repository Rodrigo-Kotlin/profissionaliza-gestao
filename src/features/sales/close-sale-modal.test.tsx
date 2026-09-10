import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloseSaleModal } from './close-sale-modal'
import type { CrmLeadDetail } from '../crm/crm-types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const rpcMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock }
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}))

const baseLead: CrmLeadDetail = {
  id: 'lead-1',
  lead_code: 'LEAD-2026-000001',
  person_id: 'person-1',
  full_name: 'Maria Silva',
  phone: null,
  whatsapp: null,
  email: null,
  stage_id: 'stage-1',
  stage_code: 'NEGOTIATION',
  stage_name: 'Negociação',
  source_id: null,
  source_name: null,
  course_interest_id: 'course-1',
  course_name: 'Administração',
  owner_user_id: 'user-1',
  owner_name: 'João',
  status: 'OPEN',
  temperature: 'HOT',
  qualification_start_period: null,
  preferred_shift: null,
  preferred_modality: null,
  budget_notes: null,
  decision_maker: null,
  source_detail: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  estimated_value: 1500,
  proposed_value: 1200,
  proposal_sent_at: null,
  commercial_notes: null,
  lost_reason_id: null,
  lost_reason_name: null,
  lost_notes: null,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  closed_at: null,
  days_in_pipeline: 30,
  sale_id: null,
  sale_code: null,
  sale_status: null,
  sale_net_value: null,
  sale_created_at: null,
  next_activity: null
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
}

describe('CloseSaleModal', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    rpcMock.mockResolvedValue({ data: [], error: null })
  })

  it('renders step 1 form fields when open', () => {
    render(<CloseSaleModal lead={baseLead} open={true} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.getByText('Fechar venda')).toBeInTheDocument()
    expect(screen.getByText('Revisar venda')).toBeInTheDocument()
    expect(screen.queryByText('Confirmar venda')).not.toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<CloseSaleModal lead={baseLead} open={false} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.queryByText('Fechar venda')).not.toBeInTheDocument()
  })

  it('shows validation error when submitting without course', async () => {
    const user = userEvent.setup()
    render(<CloseSaleModal lead={{ ...baseLead, course_interest_id: null }} open={true} onOpenChange={vi.fn()} />, { wrapper })
    await user.click(screen.getByText('Revisar venda'))
    await waitFor(() => {
      expect(screen.getByText('Curso obrigatório')).toBeInTheDocument()
    })
  })

  it('navigates to step 2 review after valid step 1', async () => {
    const user = userEvent.setup()
    render(<CloseSaleModal lead={baseLead} open={true} onOpenChange={vi.fn()} />, { wrapper })
    await user.click(screen.getByText('Revisar venda'))
    await waitFor(() => {
      expect(screen.getByText('Confirmar venda')).toBeInTheDocument()
    })
    expect(screen.getByText('Voltar')).toBeInTheDocument()
  })

  it('goes back to step 1 from step 2', async () => {
    const user = userEvent.setup()
    render(<CloseSaleModal lead={baseLead} open={true} onOpenChange={vi.fn()} />, { wrapper })
    await user.click(screen.getByText('Revisar venda'))
    await waitFor(() => {
      expect(screen.getByText('Confirmar venda')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Voltar'))
    expect(screen.getByText('Revisar venda')).toBeInTheDocument()
  })

  it('shows review info on step 2', async () => {
    const user = userEvent.setup()
    render(<CloseSaleModal lead={baseLead} open={true} onOpenChange={vi.fn()} />, { wrapper })
    await user.click(screen.getByText('Revisar venda'))
    await waitFor(() => {
      expect(screen.getByText('Confirmar venda')).toBeInTheDocument()
    })
    expect(screen.getByText('Maria Silva')).toBeInTheDocument()
    expect(screen.getByText('João')).toBeInTheDocument()
  })
})
