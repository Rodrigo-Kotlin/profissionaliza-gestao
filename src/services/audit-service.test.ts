import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logSessionEvent } from './audit-service'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: rpcMock }
}))

describe('audit-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpcMock.mockResolvedValue({ error: null })
  })

  it.each(['auth.login', 'auth.logout'] as const)('permite %s', async (eventType) => {
    await logSessionEvent(eventType)

    expect(rpcMock).toHaveBeenCalledWith('log_session_event', { p_event_type: eventType })
  })

  it('não expõe evento arbitrário ao RPC', async () => {
    await logSessionEvent('auth.admin' as never)

    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('não propaga falha de auditoria de sessão', async () => {
    rpcMock.mockResolvedValue({ error: { message: 'internal detail' } })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(logSessionEvent('auth.login')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith('Não foi possível registrar o evento de sessão.')
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('internal detail'))

    warn.mockRestore()
  })

  it('não bloqueia a sessão quando o RPC rejeita', async () => {
    rpcMock.mockRejectedValue(new Error('network detail'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await expect(logSessionEvent('auth.logout')).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith('Não foi possível registrar o evento de sessão.')

    warn.mockRestore()
  })
})
