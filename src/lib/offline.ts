import { useEffect, useState } from 'react'

export const OFFLINE_MESSAGE = 'Sem conexão. Reconecte para salvar esta alteração.'
export const REQUEST_TIMEOUT_MESSAGE = 'Não foi possível concluir a operação. Verifique sua conexão e tente novamente.'

export class OfflineConnectionError extends Error {
  constructor(message = OFFLINE_MESSAGE) {
    super(message)
    this.name = 'OfflineConnectionError'
  }
}

export class RequestTimeoutError extends Error {
  constructor(message = REQUEST_TIMEOUT_MESSAGE) {
    super(message)
    this.name = 'RequestTimeoutError'
  }
}

export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function assertOnline(): void {
  if (!isOnline()) throw new OfflineConnectionError()
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new RequestTimeoutError()), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export function isOfflineError(err: unknown): boolean {
  return err instanceof OfflineConnectionError
}

const NETWORK_ERROR_NAME = new Set(['NetworkError', 'TypeError'])
const NETWORK_ERROR_CODES = new Set([
  'ERR_NETWORK',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT'
])

function structuredNetworkError(err: { name?: unknown; code?: unknown }): boolean {
  if (typeof err.name === 'string' && err.name === 'NetworkError') return true
  return typeof err.code === 'string' && NETWORK_ERROR_CODES.has(err.code)
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (structuredNetworkError(err as { name?: unknown; code?: unknown })) return true

  if (typeof (err as { status?: unknown }).status === 'number') return false

  const message = err.message.toLowerCase()
  if (err instanceof TypeError) {
    return (
      message.includes('failed to fetch') ||
      message.includes('networkerror when attempting to fetch resource') ||
      message.includes('network request failed') ||
      message.includes('load failed')
    )
  }
  if (NETWORK_ERROR_NAME.has(err.name) || (err as { code?: unknown }).code === 'ERR_NETWORK') {
    return message.includes('network') || message.includes('fetch')
  }
  return false
}

export function offlineAwareMessage(err: unknown, fallback: string): string {
  return isOfflineError(err) || isNetworkError(err) ? OFFLINE_MESSAGE : fallback
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
