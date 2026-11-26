import type { CommercialOfferType, SaleItem } from '@/types/database'

export type SaleCourseDisplayMode = 'LEGACY' | 'SINGLE' | 'MULTIPLE'

export type SaleReadModelPresentation = {
  items: SaleItem[]
  item_count: number
  item_count_matches_items: boolean
  course_display_mode: SaleCourseDisplayMode
  course_summary: string
  offer_type: CommercialOfferType | string | null
  commercial_type: CommercialOfferType | string
}

type SaleReadModelInput = {
  items?: readonly SaleItem[] | null
  item_count?: number | null
  course_name_snapshot?: string | null
  course_name?: string | null
  offer_type_snapshot?: CommercialOfferType | string | null
}

/**
 * Client-side mirror of the SQL read model. It derives presentation fields only
 * from Sale snapshots and Sale Items; it never looks up the live catalog.
 * A mismatched item_count is preserved and flagged instead of being hidden.
 */
export function normalizeSaleReadModel(input: SaleReadModelInput): SaleReadModelPresentation {
  const items = Array.isArray(input.items)
    ? [...input.items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    : []

  const rawCount = input.item_count
  const hasCount = typeof rawCount === 'number' && Number.isInteger(rawCount) && rawCount >= 0
  const itemCount = hasCount ? rawCount : items.length
  const itemCountMatchesItems = !hasCount || rawCount === items.length

  const courseDisplayMode: SaleCourseDisplayMode =
    items.length === 0 ? 'LEGACY' : items.length === 1 ? 'SINGLE' : 'MULTIPLE'

  const legacyCourseName = input.course_name_snapshot ?? input.course_name ?? ''
  const courseSummary =
    items.length === 0
      ? legacyCourseName
      : items.length === 1
        ? items[0]!.course_name_snapshot
        : `${items.length} cursos`

  const offerType = input.offer_type_snapshot ?? null

  return {
    items,
    item_count: itemCount,
    item_count_matches_items: itemCountMatchesItems,
    course_display_mode: courseDisplayMode,
    course_summary: courseSummary,
    offer_type: offerType,
    commercial_type: offerType ?? 'LEGACY'
  }
}

export const SALE_COURSE_DISPLAY_MODE_LABELS: Record<SaleCourseDisplayMode, string> = {
  LEGACY: 'Histórico',
  SINGLE: 'Curso único',
  MULTIPLE: 'Múltiplos cursos'
}

const COMMERCIAL_TYPE_LABELS: Record<string, string> = {
  LEGACY: 'Histórico',
  COURSE: 'Curso regular',
  ONLINE_CATALOG: 'Catálogo online',
  PROGRAM: 'Programa',
  SERVICE: 'Serviço',
  MODULE: 'Módulo',
  OTHER: 'Outro'
}

export function formatSaleCommercialType(value: SaleReadModelPresentation['commercial_type']): string {
  return COMMERCIAL_TYPE_LABELS[value] ?? value
}

/**
 * Same rule used by list_sales: a Sale matches when the course is its legacy
 * scalar course or one of its normalized Sale Items.
 */
export function saleMatchesCourseFilter(
  sale: { course_id?: string | null; items?: readonly SaleItem[] | null },
  courseId?: string | null
): boolean {
  if (!courseId) return true
  if (sale.course_id === courseId) return true
  return (sale.items ?? []).some((item) => item.course_id === courseId)
}
