import { useEffect, useRef, useState } from 'react'
import { lookupCep, normalizeCepDigits, type CepAddress } from '@/services/address/cep-service'

const sessionCache = new Map<string, CepAddress>()

export type CepLookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'invalid' | 'error'

type Options = {
  onFound?: (address: CepAddress) => void
  delayMs?: number
}

export function useCepLookup(cepValue: string | undefined, { onFound, delayMs = 400 }: Options = {}) {
  const normalized = normalizeCepDigits(cepValue ?? '')
  const [status, setStatus] = useState<CepLookupStatus>('idle')
  const onFoundRef = useRef(onFound)
  onFoundRef.current = onFound

  useEffect(() => {
    if (normalized.length === 0) {
      setStatus('idle')
      return
    }
    if (normalized.length < 8) {
      setStatus('idle')
      return
    }
    if (normalized.length > 8) {
      setStatus('invalid')
      return
    }

    let cancelled = false
    setStatus('loading')

    const timer = window.setTimeout(async () => {
      const cached = sessionCache.get(normalized)
      if (cached) {
        if (!cancelled) {
          setStatus('found')
          onFoundRef.current?.(cached)
        }
        return
      }

      const result = await lookupCep({ cep: normalized })
      if (cancelled) return

      if (result.ok) {
        sessionCache.set(normalized, result.address)
        setStatus('found')
        onFoundRef.current?.(result.address)
      } else if (result.error === 'not_found') {
        setStatus('not_found')
      } else if (result.error === 'invalid') {
        setStatus('invalid')
      } else {
        setStatus('error')
      }
    }, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [normalized, delayMs])

  return { status }
}

export { sessionCache as cepSessionCache }