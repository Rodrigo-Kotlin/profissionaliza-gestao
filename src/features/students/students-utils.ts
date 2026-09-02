export const normalizeCpf = (value: string): string => value.replace(/\D/g, '')

export const isValidCpf = (value: string): boolean => {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  const calcDigit = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calcDigit(9) === Number(cpf[9]) && calcDigit(10) === Number(cpf[10])
}

export const normalizePhone = (value: string): string => value.replace(/\D/g, '')

export const normalizeEmail = (value: string): string => value.trim().toLowerCase()

export const normalizeState = (value: string): string => value.trim().toUpperCase().slice(0, 2)

export const normalizeCep = (value: string): string => value.replace(/\D/g, '').replace(/^0+/, '')

export const maskCpf = (value: string | null | undefined): string => {
  const cpf = normalizeCpf(value ?? '')
  if (cpf.length < 4) return '***.***.***-**'
  return `***.***.***-${cpf.slice(-2)}`
}

export const maskPhone = (value: string | null | undefined): string => {
  const phone = normalizePhone(value ?? '')
  if (phone.length < 4) return '••••'
  return `••••-${phone.slice(-4)}`
}

export const maskEmail = (value: string | null | undefined): string => {
  const email = normalizeEmail(value ?? '')
  if (!email.includes('@')) return '***'
  const [user, domain] = email.split('@')
  return `${(user ?? 'x').slice(0, 1)}***@${domain ?? ''}`
}

export const formatCpf = (value: string | null | undefined): string => {
  const cpf = normalizeCpf(value ?? '')
  if (cpf.length !== 11) return cpf
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

export function parseStudentListParams(
  url: URLSearchParams,
  defaults: { pageSize?: number; sort?: string; sortDir?: string } = {}
): {
  query: string | undefined
  status: string | undefined
  origin: string | undefined
  page: number
  pageSize: number
  sort: string
  sortDir: 'ASC' | 'DESC'
} {
  const query = url.get('q')?.trim() || undefined
  const status = url.get('status')?.trim() || undefined
  const origin = url.get('origin')?.trim() || undefined
  const page = Math.max(1, Number(url.get('page')) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(url.get('page_size')) || defaults.pageSize || 20))
  const sort = url.get('sort') || defaults.sort || 'full_name'
  const sortDir = (url.get('dir')?.toUpperCase() || defaults.sortDir || 'ASC') === 'DESC' ? 'DESC' : 'ASC'
  return { query, status, origin, page, pageSize, sort, sortDir }
}

export const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  PRE_CADASTRO: 'warning',
  ATIVO: 'success',
  INATIVO: 'neutral',
  CANCELADO: 'danger',
  CONCLUIDO: 'info'
}

export type StatusTransition = { allowed: Record<string, string[]>; requiresReason: string[] }

export const STATUS_TRANSITIONS: StatusTransition = {
  allowed: {
    PRE_CADASTRO: ['ATIVO', 'CANCELADO'],
    ATIVO: ['INATIVO', 'CANCELADO', 'CONCLUIDO'],
    INATIVO: ['ATIVO', 'CANCELADO'],
    CANCELADO: ['PRE_CADASTRO'],
    CONCLUIDO: []
  },
  requiresReason: ['INATIVO', 'CANCELADO', 'CONCLUIDO']
}

export const getNextStatuses = (current: string): string[] => STATUS_TRANSITIONS.allowed[current] ?? []