import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  useAssignLead,
  useCloseLost,
  useCompleteActivity,
  useCreateActivity,
  useCreateCourse,
  useCreateLead,
  useMoveStage,
  useRescheduleActivity,
  useUpdateCourse,
  useUpdateLead
} from './crm-hooks'

const serviceMock = vi.hoisted(() => ({
  createCourse: vi.fn(),
  updateCourse: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  moveStage: vi.fn(),
  assignLead: vi.fn(),
  closeLost: vi.fn(),
  createActivity: vi.fn(),
  completeActivity: vi.fn(),
  rescheduleActivity: vi.fn()
}))
const writeAuditLogMock = vi.hoisted(() => vi.fn())

vi.mock('./crm-service', () => ({ crmService: serviceMock }))
vi.mock('@/services/audit-service', () => ({ writeAuditLog: writeAuditLogMock }))

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
}

const mutations = [
  ['course creation', useCreateCourse, {}, 'createCourse'],
  ['course update', useUpdateCourse, { courseId: 'course-1', input: { name: 'Novo' } }, 'updateCourse'],
  ['lead creation', useCreateLead, { full_name: 'Ana' }, 'createLead'],
  ['lead update', useUpdateLead, { leadId: 'lead-1', input: {} }, 'updateLead'],
  ['stage change', useMoveStage, { leadId: 'lead-1', stageId: 'stage-2' }, 'moveStage'],
  ['lead assignment', useAssignLead, { leadId: 'lead-1', ownerId: 'user-2' }, 'assignLead'],
  ['lead lost', useCloseLost, { leadId: 'lead-1', reasonId: 'reason-1' }, 'closeLost'],
  ['activity creation', useCreateActivity, { lead_id: 'lead-1', type: 'CALL', title: 'Ligar', due_at: '2026-10-01' }, 'createActivity'],
  ['activity completion', useCompleteActivity, { activityId: 'activity-1' }, 'completeActivity'],
  ['activity reschedule', useRescheduleActivity, { activityId: 'activity-1', newDueAt: '2026-10-02' }, 'rescheduleActivity']
] as const

describe('CRM hooks — auditoria de domínio fica no RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const method of Object.values(serviceMock)) method.mockResolvedValue(undefined)
  })

  it.each(mutations)('%s executa a mutation sem criar auditoria frontend', async (_name, useMutation, input, serviceName) => {
    const { result } = renderHook(() => useMutation(), { wrapper })
    const mutation = result.current as unknown as { mutateAsync: (variables: unknown) => Promise<unknown> }

    await mutation.mutateAsync(input)

    expect(serviceMock[serviceName]).toHaveBeenCalled()
    expect(writeAuditLogMock).not.toHaveBeenCalled()
  })

  it('mantém a invalidação após criar um lead', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const testWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useCreateLead(), { wrapper: testWrapper })

    await result.current.mutateAsync({ full_name: 'Ana' })

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled())
    expect(writeAuditLogMock).not.toHaveBeenCalled()
  })
})
