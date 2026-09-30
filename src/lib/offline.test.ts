import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  isOnline,
  assertOnline,
  OfflineConnectionError,
  isOfflineError,
  isNetworkError,
  offlineAwareMessage,
  OFFLINE_MESSAGE,
  useOnlineStatus,
} from './offline'

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

describe('isOnline', () => {
  it('retorna navigator.onLine quando disponível', () => {
    setNavigatorOnline(true)
    expect(isOnline()).toBe(true)
    setNavigatorOnline(false)
    expect(isOnline()).toBe(false)
  })
})

describe('assertOnline', () => {
  it('não lança nada quando online', () => {
    setNavigatorOnline(true)
    expect(() => assertOnline()).not.toThrow()
  })

  it('lança OfflineConnectionError quando offline', () => {
    setNavigatorOnline(false)
    expect(() => assertOnline()).toThrow(OfflineConnectionError)
  })

  it('a mensagem de erro é OFFLINE_MESSAGE', () => {
    setNavigatorOnline(false)
    try {
      assertOnline()
      expect.fail('Deveria ter lançado')
    } catch (err) {
      expect((err as Error).message).toBe(OFFLINE_MESSAGE)
    }
  })
})

describe('isOfflineError', () => {
  it('retorna true para OfflineConnectionError', () => {
    expect(isOfflineError(new OfflineConnectionError())).toBe(true)
  })

  it('retorna false para outros erros', () => {
    expect(isOfflineError(new Error('generico'))).toBe(false)
    expect(isOfflineError(null)).toBe(false)
    expect(isOfflineError('string')).toBe(false)
  })
})

describe('isNetworkError', () => {
  it('reconhece TypeError "Failed to fetch"', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('reconhece TypeError "NetworkError when attempting to fetch resource"', () => {
    expect(isNetworkError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(true)
  })

  it('reconhece TypeError "Network request failed"', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true)
  })

  it('reconhece erro com name NetworkError (DOMException/polyfill)', () => {
    const err = new Error('Failed')
    err.name = 'NetworkError'
    expect(isNetworkError(err)).toBe(true)
  })

  it('reconhece erro com code ERR_NETWORK', () => {
    const err = new Error('network') as Error & { code?: string }
    err.code = 'ERR_NETWORK'
    expect(isNetworkError(err)).toBe(true)
  })

  it('reconhece códigos de socket claros (ECONNRESET, ETIMEDOUT, ENETUNREACH...)', () => {
    for (const code of ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'ENETDOWN', 'EHOSTUNREACH']) {
      const err = new Error('erro') as Error & { code?: string }
      err.code = code
      expect(isNetworkError(err)).toBe(true)
    }
  })

  it('NÃO reconhece TypeError sem relação com rede (bug de programação)', () => {
    expect(isNetworkError(new TypeError('Cannot read properties of undefined'))).toBe(false)
    expect(isNetworkError(new TypeError('x.toUpperCase is not a function'))).toBe(false)
  })

  it('NÃO reconhece erro PostgreSQL/RPC (permission denied, validation, P0001, 22023)', () => {
    const pg = new Error('permission denied for rpc create_student') as Error & { code?: string }
    pg.code = '42501'
    expect(isNetworkError(pg)).toBe(false)
    expect(isNetworkError(new Error('validation error'))).toBe(false)
    const p0001 = new Error('raise_exception') as Error & { code?: string }
    p0001.code = 'P0001'
    expect(isNetworkError(p0001)).toBe(false)
    const p22023 = new Error('invalid_parameter_value') as Error & { code?: string }
    p22023.code = '22023'
    expect(isNetworkError(p22023)).toBe(false)
  })

  it('NÃO reconhece erro de negócio com mensagem contendo "failed"', () => {
    expect(isNetworkError(new Error('sale creation failed: contract required'))).toBe(false)
  })

  it('NÃO reconhece erro de negócio genérico (CPF já cadastrado)', () => {
    expect(isNetworkError(new Error('CPF já cadastrado'))).toBe(false)
  })

  it('NÃO reconhece erro desconhecido nem valores não-Error', () => {
    expect(isNetworkError(new Error('anything else'))).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError('Failed to fetch')).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
})

describe('offlineAwareMessage', () => {
  it('retorna OFFLINE_MESSAGE quando OfflineConnectionError (A)', () => {
    expect(offlineAwareMessage(new OfflineConnectionError(), 'fallback')).toBe(OFFLINE_MESSAGE)
  })

  it('retorna OFFLINE_MESSAGE quando network failure com onLine=true (B)', () => {
    expect(offlineAwareMessage(new TypeError('Failed to fetch'), 'fallback')).toBe(OFFLINE_MESSAGE)
  })

  it('retorna OFFLINE_MESSAGE para erro de rede claro (C)', () => {
    const err = new Error('Failed') as Error & { code?: string }
    err.code = 'ECONNRESET'
    expect(offlineAwareMessage(err, 'fallback')).toBe(OFFLINE_MESSAGE)
  })

  it('retorna fallback para erro PostgreSQL/RPC (D)', () => {
    const pg = new Error('permission denied') as Error & { code?: string }
    pg.code = '42501'
    expect(offlineAwareMessage(pg, 'fallback RPC')).toBe('fallback RPC')
    expect(offlineAwareMessage(new Error('validation error'), 'fallback RPC')).toBe('fallback RPC')
    const p0001 = new Error('raise_exception') as Error & { code?: string }
    p0001.code = 'P0001'
    expect(offlineAwareMessage(p0001, 'fallback RPC')).toBe('fallback RPC')
  })

  it('retorna fallback para erro de negócio (E)', () => {
    expect(offlineAwareMessage(new Error('CPF já cadastrado'), 'fallback N')).toBe('fallback N')
  })

  it('retorna fallback para erro desconhecido (F)', () => {
    expect(offlineAwareMessage(new Error('unknown'), 'fallback X')).toBe('fallback X')
    expect(offlineAwareMessage('string', 'fallback X')).toBe('fallback X')
  })

  it('retorna fallback quando não é erro offline', () => {
    expect(offlineAwareMessage(new Error('rpc error'), 'fallback Generico')).toBe('fallback Generico')
  })

  it('retorna fallback para erros não-Error', () => {
    expect(offlineAwareMessage('string error', 'fallback')).toBe('fallback')
    expect(offlineAwareMessage(null, 'fallback')).toBe('fallback')
  })
})

describe('useOnlineStatus', () => {
  beforeEach(() => {
    setNavigatorOnline(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retorna true quando navigator.onLine é true', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('retorna false quando navigator.onLine é false', () => {
    setNavigatorOnline(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('reage ao evento offline', async () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    await act(async () => {
      setNavigatorOnline(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('reage ao evento online', async () => {
    setNavigatorOnline(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    await act(async () => {
      setNavigatorOnline(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })
})
