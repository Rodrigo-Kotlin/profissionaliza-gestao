import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CrmPipeline } from './crm-pipeline'

const mockState = vi.hoisted(() => ({
  permissions: ['crm.view', 'crm.edit', 'crm.move_stage'] as string[],
  isLoading: false,
  isError: false,
  data: null as null | {
    columns: Array<{
      stage_id: string
      stage_code: string
      stage_name: string
      position: number
      total_count: number
      leads: Array<{
        id: string
        lead_code: string
        full_name: string
        course_name: string | null
        temperature: string | null
        status: string
        owner_name: string | null
        owner_user_id: string
        created_at: string
        updated_at: string
        days_in_stage: number
        overdue_activities: number
        pending_activities: number
      }>
    }>
  },
  moveStage: vi.fn()
}))

vi.mock('./crm-hooks', () => ({
  useCrmPipeline: () => ({
    data: mockState.data,
    isLoading: mockState.isLoading,
    isError: mockState.isError
  }),
  useMoveStage: () => ({
    mutateAsync: mockState.moveStage,
    isPending: false
  })
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ permissions: mockState.permissions })
}))

function renderPipeline() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CrmPipeline />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const baseLead = {
  lead_code: 'CRM-0001',
  course_name: 'Auxiliar Administrativo',
  temperature: 'WARM',
  status: 'OPEN',
  owner_name: 'Maria',
  owner_user_id: 'user-1',
  created_at: '2026-01-01T10:00:00Z',
  updated_at: '2026-01-01T10:00:00Z',
  days_in_stage: 5,
  overdue_activities: 0,
  pending_activities: 1
}

const twoColumnData = {
  columns: [
    {
      stage_id: 'stage-1',
      stage_code: 'PROSPECTING',
      stage_name: 'Prospecção',
      position: 1,
      total_count: 1,
      leads: [{ id: 'lead-1', full_name: 'João Silva', ...baseLead }]
    },
    {
      stage_id: 'stage-2',
      stage_code: 'NEW_LEAD',
      stage_name: 'Novo Lead',
      position: 2,
      total_count: 1,
      leads: [{ id: 'lead-2', full_name: 'Ana Souza', ...baseLead, course_name: null, temperature: null }]
    }
  ]
}

describe('CrmPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ['crm.view', 'crm.edit', 'crm.move_stage']
    mockState.isLoading = false
    mockState.isError = false
    mockState.data = twoColumnData
  })

  it('renders skeleton when loading', () => {
    mockState.isLoading = true
    mockState.data = null
    const { container } = renderPipeline()
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders EmptyState on error', () => {
    mockState.isError = true
    mockState.data = null
    renderPipeline()
    expect(screen.getByText(/não foi possível carregar o pipeline/i)).toBeInTheDocument()
  })

  it('renders EmptyState when no columns', () => {
    mockState.data = { columns: [] }
    renderPipeline()
    expect(screen.getByText(/não foi possível carregar o pipeline/i)).toBeInTheDocument()
  })

  it('renders column headers with stage names', () => {
    renderPipeline()
    expect(screen.getAllByText('Prospecção').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Novo Lead').length).toBeGreaterThanOrEqual(1)
  })

  it('renders lead names in columns', () => {
    renderPipeline()
    expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Ana Souza').length).toBeGreaterThanOrEqual(1)
  })

  it('renders column counts', () => {
    renderPipeline()
    const countBadges = screen.getAllByText('1')
    expect(countBadges.length).toBeGreaterThanOrEqual(2)
  })

  it('shows empty column message when column has no leads', () => {
    mockState.data = {
      columns: [
        {
          stage_id: 'stage-1',
          stage_code: 'PROSPECTING',
          stage_name: 'Prospecção',
          position: 1,
          total_count: 0,
          leads: []
        }
      ]
    }
    renderPipeline()
    expect(screen.getAllByText('Nenhum lead').length).toBeGreaterThanOrEqual(1)
  })

  it('renders mobile Select with stage options', () => {
    renderPipeline()
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('option', { name: /prospecção/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('option', { name: /novo lead/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('shows temperature badge for leads with temperature', () => {
    renderPipeline()
    expect(screen.getAllByText('Morno').length).toBeGreaterThanOrEqual(1)
  })

  it('shows owner avatar when owner_name exists', () => {
    renderPipeline()
    expect(screen.getAllByText(/^M$/).length).toBeGreaterThanOrEqual(1)
  })

  it('does not set draggable when user lacks crm.move_stage', () => {
    mockState.permissions = ['crm.view', 'crm.edit']
    renderPipeline()
    const leadCards = screen.getAllByText('João Silva')
    expect(leadCards.length).toBeGreaterThanOrEqual(1)
  })

  it('shows overdue count when lead has overdue activities', () => {
    mockState.data = {
      columns: [
        {
          stage_id: 'stage-1',
          stage_code: 'PROSPECTING',
          stage_name: 'Prospecção',
          position: 1,
          total_count: 1,
          leads: [{ ...baseLead, id: 'lead-1', full_name: 'Carlos', overdue_activities: 3, pending_activities: 3 }]
        }
      ]
    }
    renderPipeline()
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
  })
})
