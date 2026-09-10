import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CancelSaleDialog } from './cancel-sale-dialog'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const rpcMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock }
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
}

describe('CancelSaleDialog', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('renders when open', () => {
    render(<CancelSaleDialog saleId="sale-1" saleCode="VND-2026-000001" open={true} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.getByText(/Cancelar venda VND-2026-000001/)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<CancelSaleDialog saleId="sale-1" saleCode="VND-2026-000001" open={false} onOpenChange={vi.fn()} />, { wrapper })
    expect(screen.queryByText(/Cancelar venda/)).not.toBeInTheDocument()
  })

  it('shows validation error when submitting empty reason', async () => {
    const user = userEvent.setup()
    render(<CancelSaleDialog saleId="sale-1" saleCode="VND-2026-000001" open={true} onOpenChange={vi.fn()} />, { wrapper })
    await user.click(screen.getByText('Confirmar cancelamento'))
    await waitFor(() => {
      expect(screen.getByText('Motivo do cancelamento obrigatório')).toBeInTheDocument()
    })
  })
})
