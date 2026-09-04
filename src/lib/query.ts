const NO_RETRY_CODES = new Set(['PGRST202', '42501', '42883', 'P0002'])

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false
  const code = (error as { code?: string })?.code
  if (code && NO_RETRY_CODES.has(code)) return false
  return true
}

// ---------------------------------------------------------------------------
// PostgREST / Supabase error helpers
// ---------------------------------------------------------------------------

export interface PostgrestError {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export function isPostgrestError(error: unknown, code?: string): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as Record<string, unknown>
  if (code !== undefined) return e.code === code
  return typeof e.code === 'string' && e.code.length > 0
}

export function getPostgrestCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  return (error as { code?: string })?.code
}

const COURSE_ERROR_MESSAGES: Record<string, string> = {
  '23505': 'Já existe um curso com esse código.',
  '42501': 'Você não possui permissão para gerenciar cursos.',
  '22023': 'Dados inválidos. Verifique os campos preenchidos.'
}

const COURSE_ERROR_FIELDS: Record<string, string> = {
  '23505': 'code'
}

export function getCourseErrorMessage(error: unknown): string {
  const code = getPostgrestCode(error)
  if (code && code in COURSE_ERROR_MESSAGES) return COURSE_ERROR_MESSAGES[code]!
  if (code && code.startsWith('PGRST')) return 'Erro de integração com o servidor. Tente novamente.'
  return 'Não foi possível salvar o curso.'
}

export function getCourseErrorField(error: unknown): string | undefined {
  const code = getPostgrestCode(error)
  if (code && code in COURSE_ERROR_FIELDS) return COURSE_ERROR_FIELDS[code]
  return undefined
}
