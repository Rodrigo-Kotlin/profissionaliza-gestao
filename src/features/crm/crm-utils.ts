import type { CrmLeadListParams } from './crm-types'

export function parseCrmLeadListParams(search: URLSearchParams): CrmLeadListParams {
  return {
    q: search.get('q') || undefined,
    stage_code: search.get('stage') || undefined,
    owner_user_id: search.get('owner') || undefined,
    source_id: search.get('source') || undefined,
    course_interest_id: search.get('course') || undefined,
    temperature: (search.get('temp') as CrmLeadListParams['temperature']) || undefined,
    status: (search.get('status') as CrmLeadListParams['status']) || 'OPEN',
    overdue_only: search.get('overdue') === '1',
    no_activity: search.get('no_activity') === '1',
    page: Number(search.get('page')) || 1,
    page_size: Number(search.get('page_size')) || 25,
    sort: search.get('sort') || 'created_at',
    dir: search.get('dir') || 'DESC'
  }
}

export function updateSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | undefined | null>
): URLSearchParams {
  const next = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || value === '') {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }
  if ('page' in updates) {
    // keep page
  } else if (Object.keys(updates).some((k) => k !== 'page' && k !== 'page_size' && next.has(k))) {
    next.set('page', '1')
  }
  return next
}

export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function parseCurrencyInput(value: string): number | undefined {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? undefined : num
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function getDaysInStage(createdAt: string): number {
  const diff = Date.now() - new Date(createdAt).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function isOverdue(dueAt: string): boolean {
  return new Date(dueAt) < new Date()
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atrás`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem atrás`
  return `${Math.floor(diffDays / 30)} mês(es) atrás`
}

export function formatDueAt(dueAt: string): string {
  const date = new Date(dueAt)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  if (isToday) return `Hoje ${time}`
  if (isTomorrow) return `Amanhã ${time}`

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time
}

export function stageMoveErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string | number })?.code
  const message = (err as { message?: string })?.message ?? ''
  const rawCode = typeof code === 'number' ? String(code) : code
  if (rawCode === '42501') return 'Você não possui permissão para mover este Lead.'
  if (rawCode === '22023' && message.toLowerCase().includes('course')) {
    return 'Informe o curso de interesse antes de qualificar o Lead.'
  }
  return null
}
