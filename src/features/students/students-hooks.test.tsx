import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  useChangeStudentStatus,
  useCreateStudent,
  useLinkGuardian,
  useUnlinkGuardian,
  useUpdateStudent
} from './students-hooks'

const serviceMock = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  changeStatus: vi.fn(),
  linkGuardian: vi.fn(),
  unlinkGuardian: vi.fn()
}))
const writeAuditLogMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ success: vi.fn() }))

vi.mock('./students-service', () => ({ studentsService: serviceMock }))
vi.mock('@/services/audit-service', () => ({ writeAuditLog: writeAuditLogMock }))
vi.mock('sonner', () => ({ toast: toastMock }))

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
}

describe('Students hooks — auditoria de domínio fica no RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMock.create.mockResolvedValue('student-1')
    serviceMock.update.mockResolvedValue(undefined)
    serviceMock.changeStatus.mockResolvedValue(undefined)
    serviceMock.linkGuardian.mockResolvedValue('guardian-1')
    serviceMock.unlinkGuardian.mockResolvedValue(undefined)
  })

  it('cria aluno, invalida consultas e não chama auditoria frontend', async () => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const testWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useCreateStudent(), { wrapper: testWrapper })

    await result.current.mutateAsync({ full_name: 'Ana', origin: 'SITE' })

    expect(serviceMock.create).toHaveBeenCalled()
    expect(invalidateQueries).toHaveBeenCalled()
    expect(writeAuditLogMock).not.toHaveBeenCalled()
  })

  it.each([
    ['update', useUpdateStudent, { id: 'student-1', input: { full_name: 'Ana' } }, 'update'],
    ['status', useChangeStudentStatus, { id: 'student-1', status: 'ATIVO' }, 'changeStatus'],
    ['link guardian', () => useLinkGuardian('student-1'), { full_name: 'Responsável', relationship: 'OUTRO', is_primary_contact: false, is_financial_responsible: false, is_legal_guardian: false }, 'linkGuardian'],
    ['unlink guardian', () => useUnlinkGuardian('student-1'), 'guardian-1', 'unlinkGuardian']
  ] as const)('%s mantém a mutation sem auditoria frontend', async (_name, useMutation, input, serviceName) => {
    const { result } = renderHook(() => useMutation(), { wrapper })
    const mutation = result.current as unknown as { mutateAsync: (variables: unknown) => Promise<unknown> }

    await mutation.mutateAsync(input)

    expect(serviceMock[serviceName]).toHaveBeenCalled()
    expect(writeAuditLogMock).not.toHaveBeenCalled()
  })
})
