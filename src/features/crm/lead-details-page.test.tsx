import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { toast } from 'sonner'
import { LeadDetailsPage } from './lead-details-page'

function mockLead(status: string = 'OPEN') {
  return {
    id: 'lead-1',
    lead_code: 'CRM-0001',
    person_id: 'p1',
    full_name: 'João Silva',
    phone: '11999990000',
    whatsapp: null,
    email: null,
    stage_id: 'stage-2',
    stage_code: 'NOVO_LEAD',
    stage_name: 'Novo Lead',
    source_id: 'src-1',
    source_name: 'WhatsApp',
    course_interest_id: 'course-1',
    course_name: 'Auxiliar Administrativo',
    owner_user_id: 'user-1',
    owner_name: 'Maria',
    status,
    temperature: 'WARM',
    qualification_start_period: null,
    preferred_shift: null,
    preferred_modality: null,
    budget_notes: null,
    decision_maker: null,
    source_detail: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    estimated_value: null,
    proposed_value: null,
    proposal_sent_at: null,
    commercial_notes: null,
    lost_reason_id: null,
    lost_reason_name: null,
    lost_notes: null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    closed_at: null,
    days_in_pipeline: 10,
    next_activity: {
      id: 'act-1',
      type: 'CALL',
      title: 'Ligação de follow-up',
      due_at: '2026-09-05T10:00:00Z',
      status: 'PENDING',
      is_overdue: false
    }
  }
}

const mockState = vi.hoisted(() => ({
  permissions: ['crm.view', 'crm.edit', 'crm.move_stage', 'crm.close_lost', 'crm.activities.manage'] as string[],
  leadData: mockLead() as ReturnType<typeof mockLead>,
  leadIsLoading: false,
  leadIsError: false,
  completeActivity: vi.fn(),
  completeIsPending: false,
  rescheduleActivity: vi.fn(),
  rescheduleIsPending: false,
  updateLead: vi.fn(),
  updateIsPending: false,
  moveStage: vi.fn(),
  moveIsPending: false,
  closeLost: vi.fn(),
  closeIsPending: false,
  createActivity: vi.fn(),
  createIsPending: false,
  timelineData: null as null | {
    data: Array<{
      id: string
      event_type: string
      occurred_at: string
      title: string
      description: string
      actor_user_id: string | null
      actor_name: string | null
      entity_type: string
      entity_id: string
      metadata: Record<string, unknown>
    }>
    total: number
  },
  timelineIsLoading: false,
  timelineIsError: false
}))

vi.mock('./crm-hooks', () => ({
  useCrmLeadDetail: () => ({
    data: mockState.leadData,
    isLoading: mockState.leadIsLoading,
    isError: mockState.leadIsError,
    refetch: vi.fn()
  }),
  useCrmCourses: () => ({ data: [], isLoading: false, isError: false }),
  useUpdateLead: () => ({
    mutateAsync: mockState.updateLead,
    isPending: mockState.updateIsPending
  }),
  useMoveStage: () => ({
    mutateAsync: mockState.moveStage,
    isPending: mockState.moveIsPending
  }),
  useCloseLost: () => ({
    mutateAsync: mockState.closeLost,
    isPending: mockState.closeIsPending
  }),
  useCompleteActivity: () => ({
    mutateAsync: mockState.completeActivity,
    isPending: mockState.completeIsPending
  }),
  useRescheduleActivity: () => ({
    mutateAsync: mockState.rescheduleActivity,
    isPending: mockState.rescheduleIsPending
  }),
  useCreateActivity: () => ({
    mutateAsync: mockState.createActivity,
    isPending: mockState.createIsPending
  }),
  useCrmLeadActivities: () => ({
    data: {
      data: [
        {
          id: 'act-1',
          lead_id: 'lead-1',
          type: 'CALL',
          title: 'Ligação de follow-up',
          description: null,
          due_at: '2026-09-05T10:00:00Z',
          status: 'PENDING',
          completed_at: null,
          outcome: null,
          owner_user_id: 'user-1',
          owner_name: 'Maria',
          is_overdue: false
        }
      ],
      total: 1
    },
    isLoading: false,
    isError: false
  }),
  useCrmLeadTimeline: () => ({
    data: mockState.timelineData,
    isLoading: mockState.timelineIsLoading,
    isError: mockState.timelineIsError
  }),
  useCrmPipelineStages: () => ({
    data: [
      { id: 'stage-1', code: 'PROSPECTING', name: 'Prospecção', position: 1, is_kanban: true },
      { id: 'stage-2', code: 'NEW_LEAD', name: 'Novo Lead', position: 2, is_kanban: true }
    ],
    isLoading: false,
    isError: false
  })
}))

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({ permissions: mockState.permissions })
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/crm/leads/lead-1']}>
      <Routes>
        <Route path="/crm/leads/:id" element={<LeadDetailsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LeadDetailsPage — domain-state gating', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ['crm.view', 'crm.edit', 'crm.move_stage', 'crm.close_lost', 'crm.activities.manage']
    mockState.leadData = mockLead('OPEN')
    mockState.completeIsPending = false
    mockState.rescheduleIsPending = false
  })

  it('mostra Editar/Mover/Nova atividade/Perdido para lead OPEN', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mover etapa/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nova atividade/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /marcar como perdido/i })).toBeInTheDocument()
  })

  it('esconde Editar/Mover/Nova atividade/Perdido para lead LOST', () => {
    mockState.leadData = mockLead('LOST')
    renderPage()
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /mover etapa/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /nova atividade/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /marcar como perdido/i })).toBeNull()
  })

  it('esconde Editar/Mover/Nova atividade/Perdido para lead WON', () => {
    mockState.leadData = mockLead('WON')
    renderPage()
    expect(screen.queryByRole('button', { name: /editar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /mover etapa/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /nova atividade/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /marcar como perdido/i })).toBeNull()
  })

  it('esconde Concluir/Reagendar na aba Atividades para lead LOST', async () => {
    mockState.leadData = mockLead('LOST')
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: /atividades/i }))

    expect(screen.queryByRole('button', { name: /concluir/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /reagendar/i })).toBeNull()
  })

  it('mostra Concluir/Reagendar na aba Atividades para lead OPEN', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: /atividades/i }))

    const concluirBtns = screen.getAllByRole('button', { name: /concluir/i })
    expect(concluirBtns.length).toBeGreaterThanOrEqual(1)
  })
})

describe('LeadDetailsPage — activity mutations pass leadId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ['crm.view', 'crm.edit', 'crm.move_stage', 'crm.close_lost', 'crm.activities.manage']
    mockState.leadData = mockLead('OPEN')
    mockState.completeActivity.mockResolvedValue(undefined)
    mockState.rescheduleActivity.mockResolvedValue(undefined)
  })

  it('sidebar complete envia leadId para a mutation', async () => {
    const user = userEvent.setup()
    renderPage()

    const sidebarCard = screen.getByText('Próxima atividade').closest('.p-5') as HTMLElement
    const sidebarConcluir = within(sidebarCard).getByRole('button', { name: /concluir/i })
    await user.click(sidebarConcluir)

    expect(mockState.completeActivity).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'act-1', leadId: 'lead-1' })
    )
  })

  it('concluir na aba Atividades envia leadId para a mutation', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: /atividades/i }))
    const tabConcluir = screen.getAllByRole('button', { name: /concluir/i })[0]!
    await user.click(tabConcluir)
    const okBtn = screen.getByRole('button', { name: /^ok$/i })
    await user.click(okBtn)

    expect(mockState.completeActivity).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'act-1', leadId: 'lead-1' })
    )
  })

  it('reagendar envia leadId para a mutation', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: /atividades/i }))
    const tabReagendar = screen.getAllByRole('button', { name: /reagendar/i })[0]!
    await user.click(tabReagendar)

    const dateInput = screen.getByDisplayValue('')
    fireEvent.change(dateInput, { target: { value: '2026-09-10T14:00' } })

    const reagendarBtns = screen.getAllByRole('button', { name: /^reagendar$/i })
    const confirmReagendar = reagendarBtns[reagendarBtns.length - 1]!
    await user.click(confirmReagendar)

    expect(mockState.rescheduleActivity).toHaveBeenCalledWith(
      expect.objectContaining({ activityId: 'act-1', leadId: 'lead-1', newDueAt: '2026-09-10T14:00' })
    )
  })
})

describe('LeadDetailsPage — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ['crm.view', 'crm.edit', 'crm.move_stage', 'crm.close_lost', 'crm.activities.manage']
    mockState.leadData = mockLead('OPEN')
  })

  it('sidebar complete mostra toast de erro quando falha', async () => {
    const user = userEvent.setup()
    mockState.completeActivity.mockRejectedValue(new Error('RPC error'))
    const errorSpy = vi.spyOn(toast, 'error')
    renderPage()

    const sidebarCard = screen.getByText('Próxima atividade').closest('.p-5') as HTMLElement
    const sidebarConcluir = within(sidebarCard).getByRole('button', { name: /concluir/i })
    await user.click(sidebarConcluir)

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith('Não foi possível concluir a atividade.')
    })
  })
})

describe('LeadDetailsPage — loading/disabled states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ['crm.view', 'crm.edit', 'crm.move_stage', 'crm.close_lost', 'crm.activities.manage']
    mockState.leadData = mockLead('OPEN')
    mockState.completeIsPending = false
    mockState.rescheduleIsPending = false
  })

  it('botão Concluir fica disabled durante complete pending', async () => {
    mockState.completeIsPending = true
    mockState.completeActivity.mockReturnValue(new Promise(() => {}))
    renderPage()

    const sidebarCard = screen.getByText('Próxima atividade').closest('.p-5') as HTMLElement
    const sidebarConcluir = within(sidebarCard).getByRole('button', { name: /concluir/i })
    expect(sidebarConcluir).toBeDisabled()
  })

  it('botão Mover etapa fica disabled durante pending', async () => {
    mockState.moveIsPending = true
    mockState.moveStage.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /mover etapa/i }))
    const moveButton = screen.getByRole('button', { name: /^mover etapa$/i })
    expect(moveButton).toBeDisabled()
  })
})

describe('LeadDetailsPage — HistoricoTab (timeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.permissions = ['crm.view', 'crm.edit', 'crm.move_stage', 'crm.close_lost', 'crm.activities.manage']
    mockState.leadData = mockLead('OPEN')
    mockState.timelineData = null
    mockState.timelineIsLoading = false
    mockState.timelineIsError = false
  })

  async function openHistoricoTab() {
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /histórico/i }))
  }

  it('shows loading skeletons while timeline loads', async () => {
    mockState.timelineIsLoading = true
    renderPage()
    await openHistoricoTab()
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('shows error state when timeline fails', async () => {
    mockState.timelineIsError = true
    renderPage()
    await openHistoricoTab()
    expect(screen.getByText(/erro ao carregar histórico/i)).toBeInTheDocument()
  })

  it('shows empty state when timeline has no events', async () => {
    mockState.timelineData = { data: [], total: 0 }
    renderPage()
    await openHistoricoTab()
    expect(screen.getByText(/nenhum evento/i)).toBeInTheDocument()
  })

  it('renders timeline events with correct labels', async () => {
    mockState.timelineData = {
      data: [
        {
          id: 'evt-1',
          event_type: 'LEAD_CREATED',
          occurred_at: '2026-09-01T10:00:00Z',
          title: 'Lead criado',
          description: 'Lead adicionado ao pipeline',
          actor_user_id: 'user-1',
          actor_name: 'Maria',
          entity_type: 'lead',
          entity_id: 'lead-1',
          metadata: {}
        }
      ],
      total: 1
    }
    renderPage()
    await openHistoricoTab()
    expect(screen.getByText('Lead criado')).toBeInTheDocument()
    expect(screen.getByText('Lead adicionado ao pipeline')).toBeInTheDocument()
    expect(screen.getByText('Maria')).toBeInTheDocument()
  })

  it('renders stage change with arrow notation', async () => {
    mockState.timelineData = {
      data: [
        {
          id: 'evt-1',
          event_type: 'STAGE_CHANGED',
          occurred_at: '2026-09-02T14:00:00Z',
          title: 'Etapa alterada',
          description: '',
          actor_user_id: 'user-1',
          actor_name: 'João',
          entity_type: 'lead',
          entity_id: 'lead-1',
          metadata: { old_stage_name: 'Novo Lead', new_stage_name: 'Qualificado' }
        }
      ],
      total: 1
    }
    renderPage()
    await openHistoricoTab()
    expect(screen.getByText('Novo Lead → Qualificado')).toBeInTheDocument()
  })
})
