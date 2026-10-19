/* global URL */

export const PRODUCTION_PROJECT_REF = 'epjshcgsjvrydwuyqixi'

function projectRefFromUrl(url) {
  if (!url) return null
  const parsed = new URL(url)
  const match = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
  return match?.[1] ?? null
}

function isLocalUrl(url) {
  if (!url) return false
  const hostname = new URL(url).hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export function assertSafeTarget({ environment, url, projectRef, operation = 'destructive QA operation' } = {}) {
  const normalizedEnvironment = environment?.trim().toLowerCase()
  if (!normalizedEnvironment) throw new Error(`${operation} aborted: environment is required`)
  if (normalizedEnvironment !== 'development') {
    throw new Error(`${operation} aborted: only development targets are allowed`)
  }
  if (!url?.trim()) throw new Error(`${operation} aborted: Supabase URL is required`)

  let derivedRef
  try {
    derivedRef = projectRef ?? projectRefFromUrl(url)
  } catch {
    throw new Error(`${operation} aborted: Supabase URL is invalid`)
  }

  if (derivedRef === PRODUCTION_PROJECT_REF) {
    throw new Error(`${operation} aborted: production project ref is protected`)
  }
  if (derivedRef && !/^[a-z0-9]{20}$/i.test(derivedRef)) {
    throw new Error(`${operation} aborted: unknown Supabase project ref`)
  }
  if (!derivedRef && !isLocalUrl(url)) {
    throw new Error(`${operation} aborted: unknown Supabase project ref`)
  }

  return { environment: normalizedEnvironment, projectRef: derivedRef ?? 'local' }
}
