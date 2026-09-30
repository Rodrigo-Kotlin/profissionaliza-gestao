import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { CrmPage } from './crm-page'

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    permissions: ['crm.view', 'crm.create'],
    profile: null,
    user: null,
    signOut: vi.fn()
  })
}))

vi.mock('./crm-hooks', () => ({
  useCrmKpis: () => ({
    data: { open_leads: 5, qualified: 2, negotiation: 1, overdue_activities: 3 },
    isLoading: false,
    isError: false
  })
}))

vi.mock('./crm-pipeline', () => ({ CrmPipeline: () => <div data-testid="pipeline" /> }))
vi.mock('./leads-page', () => ({ LeadsPage: () => <div data-testid="leads" /> }))
vi.mock('./activities-page', () => ({ ActivitiesPage: () => <div data-testid="activities" /> }))
vi.mock('./course-catalog', () => ({ CourseCatalog: () => <div data-testid="courses" /> }))

function LocationProbe() {
  const [search] = useSearchParams()
  return <span data-testid="location-search">{search.toString()}</span>
}

function renderCrmPage(initialEntries: string[] = ['/crm']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/crm" element={<><CrmPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CrmPage — persistência de tab na URL (Fase 7)', () => {
  it('URL inicial com tab=leads ativa a aba Leads', async () => {
    renderCrmPage(['/crm?tab=leads'])
    await waitFor(() => {
      expect(screen.getByTestId('leads')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('pipeline')).toBeNull()
    expect(screen.getByTestId('location-search').textContent).toContain('tab=leads')
  })

  it('aba inválida renderiza Pipeline como fallback e limpa tab', async () => {
    renderCrmPage(['/crm?tab=foo'])
    await waitFor(() => {
      expect(screen.getByTestId('pipeline')).toBeInTheDocument()
    })
    expect(screen.getByTestId('location-search').textContent).not.toMatch(/tab=/)
  })

  it('trocar aba atualiza a URL com replace', async () => {
    const user = userEvent.setup()
    renderCrmPage()
    await waitFor(() => {
      expect(screen.getByTestId('pipeline')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Atividades' }))
    await waitFor(() => {
      expect(screen.getByTestId('activities')).toBeInTheDocument()
      expect(screen.getByTestId('location-search').textContent).toContain('tab=atividades')
    })
  })

  it('selecionar Pipeline remove o parâmetro tab', async () => {
    const user = userEvent.setup()
    renderCrmPage(['/crm?tab=leads'])
    await waitFor(() => {
      expect(screen.getByTestId('leads')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Pipeline' }))
    await waitFor(() => {
      expect(screen.queryByTestId('leads')).toBeNull()
      expect(screen.getByTestId('pipeline')).toBeInTheDocument()
      expect(screen.getByTestId('location-search').textContent).not.toMatch(/tab=/)
    })
  })
})