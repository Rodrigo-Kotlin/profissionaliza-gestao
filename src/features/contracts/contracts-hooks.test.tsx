import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OfflineConnectionError } from '@/lib/offline'
import {
  useRejectContractExecution,
  useUploadContractExecution,
  useVerifyContractExecution
} from './contracts-hooks'

const serviceMocks = vi.hoisted(() => ({
  uploadExecution: vi.fn(),
  verifyExecution: vi.fn(),
  rejectExecution: vi.fn()
}))

vi.mock('./contracts-service', () => ({ contractsService: serviceMocks }))

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
}

describe('ContractExecution mutations offline', () => {
  it.each([
    ['upload', useUploadContractExecution, 'uploadExecution'],
    ['verify', useVerifyContractExecution, 'verifyExecution'],
    ['reject', useRejectContractExecution, 'rejectExecution']
  ] as const)('%s fails immediately and is not replayed after reconnect', async (_name, hook, serviceName) => {
    const service = serviceMocks[serviceName]
    service.mockRejectedValue(new OfflineConnectionError())
    const { result } = renderHook(() => hook('contract-1', 'document-1'), { wrapper })

    const input = serviceName === 'uploadExecution'
      ? { execution_id: 'execution-1', file: new File(['pdf'], 'signed.pdf', { type: 'application/pdf' }) }
      : serviceName === 'verifyExecution'
        ? { execution_id: 'execution-1', verification_method: 'GOV_BR_VALIDAR_MANUAL' as const, signed_at: '2026-10-08T12:00:00.000Z' }
        : { execution_id: 'execution-1', rejection_reason: 'Motivo' }

    await expect((result.current.mutateAsync as (value: unknown) => Promise<unknown>)(input)).rejects.toBeInstanceOf(OfflineConnectionError)
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isPaused).toBe(false)
    expect(service).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new Event('online'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(service).toHaveBeenCalledTimes(1)
    service.mockReset()
  })
})
