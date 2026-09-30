import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ActivitiesPage } from './activities-page'

const completeActivity = vi.hoisted(() => vi.fn())
const rescheduleActivity = vi.hoisted(() => vi.fn())

vi.mock('./crm-hooks', () => ({
  useCrmAgenda: () => ({
    data: {
      data: [
        {
          id: 'act-1',
          lead_id: 'lead-1',
          lead_code: 'CRM-0001',
          lead_name: 'Ana Souza',
          type: 'CALL',
          title: 'Ligar para Ana',
          description: null,
          due_at: '2026-09-05T10:00:00Z',
          status: 'PENDING',
          owner_name: null,
          owner_user_id: 'user-1',
          is_overdue: false
        }
      ],
      total: 1
    },
    isLoading: false,
    isError: false
  }),
  useCompleteActivity: () => ({ mutateAsync: completeActivity, isPending: false }),
  useRescheduleActivity: () => ({ mutateAsync: rescheduleActivity, isPending: false })
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/crm/atividades']}>
      <Routes>
        <Route path="/crm/atividades" element={<ActivitiesPage />} />
        <Route path="/crm/leads/:id" element={<div>Lead page test</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ActivitiesPage — touch targets (Fase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    completeActivity.mockResolvedValue(undefined)
    rescheduleActivity.mockResolvedValue(undefined)
  })

  it('Concluir, Reagendar e Ver lead mantêm alvo de 44px e navegam', async () => {
    const user = userEvent.setup()
    renderPage()

    for (const name of [/concluir/i, /reagendar/i, /ver lead/i]) {
      const buttons = screen.getAllByRole('button', { name })
      expect(buttons.length).toBeGreaterThan(0)
      for (const button of buttons) expect(button.className).toContain('min-h-11')
    }

    await user.click(screen.getByRole('button', { name: /ver lead/i }))
    expect(await screen.findByText('Lead page test')).toBeInTheDocument()
  })

  it('fluxo de conclusão mantém OK/Cancelar em 44px e conclui a atividade', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /^concluir$/i }))
    expect(screen.getByPlaceholderText(/resultado/i)).toBeInTheDocument()

    const ok = screen.getByRole('button', { name: 'OK' })
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    expect(ok.className).toContain('min-h-11')
    expect(cancelar.className).toContain('min-h-11')

    await user.click(ok)
    await waitFor(() => {
      expect(completeActivity).toHaveBeenCalledWith({ activityId: 'act-1', outcome: undefined })
    })
  })
})