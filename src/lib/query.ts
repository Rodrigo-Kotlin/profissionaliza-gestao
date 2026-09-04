const NO_RETRY_CODES = new Set(['PGRST202', '42501', '42883', 'P0002'])

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  const code = (error as { code?: string })?.code
  if (code && NO_RETRY_CODES.has(code)) return false
  return true
}
