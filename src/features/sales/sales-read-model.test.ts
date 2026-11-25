import { describe, it, expect } from 'vitest'
import type { SaleItem } from '@/types/database'
import type { SaleDetail } from './sales-types'
import {
  formatSaleCommercialType,
  normalizeSaleReadModel,
  saleMatchesCourseFilter
} from './sales-read-model'

function makeItem(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: 'item-1',
    sale_id: 'sale-1',
    position: 1,
    course_id: 'course-1',
    offer_item_id: null,
    course_code_snapshot: 'CUR-001',
    course_name_snapshot: 'Enfermagem congelada',
    course_workload_snapshot: 120,
    course_modality_snapshot: 'PRESENCIAL',
    created_at: '2026-10-28T10:00:00.000Z',
    ...overrides
  }
}

function makeDetail(overrides: Partial<SaleDetail> = {}): SaleDetail {
  return {
    id: 'sale-1',
    sale_code: 'VND-2026-000001',
    status: 'CONFIRMED',
    lead_id: 'lead-1',
    lead_code: 'CRM-0001',
    person_id: 'person-1',
    full_name: 'Ana Souza',
    student_id: 'student-1',
    student_code: 'ALU-0001',
    course_id: 'course-legacy',
    course_name_snapshot: 'Enfermagem legada',
    course_price_snapshot: 2000,
    seller_user_id: 'user-1',
    seller_name: 'Carlos',
    sale_date: '2026-09-01',
    gross_value: 2000,
    discount_value: 0,
    net_value: 2000,
    payment_method: 'PIX',
    installments: 1,
    commercial_notes: null,
    canceled_at: null,
    canceled_by: null,
    canceled_by_name: null,
    cancellation_reason: null,
    created_by: 'user-1',
    created_by_name: 'Carlos',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
    offer_id: null,
    price_plan_id: null,
    offer_code_snapshot: null,
    offer_name_snapshot: null,
    offer_type_snapshot: null,
    price_plan_code_snapshot: null,
    payment_method_snapshot: null,
    pricing_model_snapshot: null,
    installment_count_snapshot: null,
    installment_amount_snapshot: null,
    quantity_min_snapshot: null,
    quantity_max_snapshot: null,
    cash_price_snapshot: null,
    enrollment_fee_snapshot: null,
    total_amount_snapshot: null,
    item_count: 0,
    items: [],
    item_count_matches_items: true,
    course_display_mode: 'LEGACY',
    course_summary: 'Enfermagem legada',
    offer_type: null,
    commercial_type: 'LEGACY',
    ...overrides
  }
}

describe('normalizeSaleReadModel — cenário A: venda histórica', () => {
  it('retorna items vazio, item_count zero e resumo do snapshot legado', () => {
    const model = normalizeSaleReadModel(makeDetail({ course_name_snapshot: 'Enfermagem legada' }))

    expect(model.items).toEqual([])
    expect(model.item_count).toBe(0)
    expect(model.item_count_matches_items).toBe(true)
    expect(model.course_display_mode).toBe('LEGACY')
    expect(model.course_summary).toBe('Enfermagem legada')
    expect(model.commercial_type).toBe('LEGACY')
  })

  it('não infere tipo comercial a partir da quantidade de itens', () => {
    const model = normalizeSaleReadModel({
      items: [makeItem()],
      item_count: 1,
      offer_type_snapshot: null
    })

    expect(model.course_display_mode).toBe('SINGLE')
    expect(model.commercial_type).toBe('LEGACY')
  })
})

describe('normalizeSaleReadModel — cenário B: venda COURSE', () => {
  it('retorna exatamente um item e usa o snapshot do item no resumo', () => {
    const model = normalizeSaleReadModel({
      items: [makeItem({ course_name_snapshot: 'Enfermagem congelada' })],
      item_count: 1,
      course_name_snapshot: 'Nome legado divergente',
      offer_type_snapshot: 'COURSE'
    })

    expect(model.items).toHaveLength(1)
    expect(model.item_count).toBe(1)
    expect(model.course_display_mode).toBe('SINGLE')
    expect(model.course_summary).toBe('Enfermagem congelada')
    expect(model.offer_type).toBe('COURSE')
    expect(model.commercial_type).toBe('COURSE')
  })
})

describe('normalizeSaleReadModel — cenário C: leitura futura de catálogo online', () => {
  it('mantém SINGLE quando uma oferta online possui apenas um curso', () => {
    const model = normalizeSaleReadModel({
      items: [makeItem()],
      item_count: 1,
      offer_type_snapshot: 'ONLINE_CATALOG'
    })

    expect(model.course_display_mode).toBe('SINGLE')
    expect(model.course_summary).toBe('Enfermagem congelada')
    expect(model.commercial_type).toBe('ONLINE_CATALOG')
  })

  it('resume duas ofertas como 2 cursos', () => {
    const model = normalizeSaleReadModel({
      items: [
        makeItem({ id: 'item-1', position: 1, course_name_snapshot: 'Curso A' }),
        makeItem({ id: 'item-2', position: 2, course_id: 'course-2', course_name_snapshot: 'Curso B' })
      ],
      item_count: 2,
      offer_type_snapshot: 'ONLINE_CATALOG'
    })

    expect(model.course_display_mode).toBe('MULTIPLE')
    expect(model.course_summary).toBe('2 cursos')
  })

  it('resume cinco ofertas como 5 cursos', () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      makeItem({
        id: `item-${index + 1}`,
        position: index + 1,
        course_id: `course-${index + 1}`,
        course_name_snapshot: `Curso ${index + 1}`
      })
    )
    const model = normalizeSaleReadModel({ items, item_count: 5, offer_type_snapshot: 'ONLINE_CATALOG' })

    expect(model.course_display_mode).toBe('MULTIPLE')
    expect(model.course_summary).toBe('5 cursos')
    expect(model.items).toHaveLength(5)
  })

  it('ordena por position antes de devolver a lista', () => {
    const items = [
      makeItem({ id: 'item-5', position: 5, course_id: 'course-5', course_name_snapshot: 'Curso E' }),
      makeItem({ id: 'item-1', position: 1, course_id: 'course-1', course_name_snapshot: 'Curso A' }),
      makeItem({ id: 'item-3', position: 3, course_id: 'course-3', course_name_snapshot: 'Curso C' })
    ]
    const model = normalizeSaleReadModel({ items, item_count: 3 })

    expect(model.items.map((item) => item.position)).toEqual([1, 3, 5])
    expect(model.items.map((item) => item.course_name_snapshot)).toEqual(['Curso A', 'Curso C', 'Curso E'])
  })
})

describe('normalizeSaleReadModel — integridade e compatibilidade', () => {
  it('preserva snapshots sem consultar catálogo vivo', () => {
    const model = normalizeSaleReadModel({
      course_name_snapshot: 'Nome legado',
      course_name: 'Nome da lista',
      items: [makeItem({ course_name_snapshot: 'Snapshot imutável' })],
      item_count: 1
    })

    expect(model.course_summary).toBe('Snapshot imutável')
    expect(model.course_summary).not.toBe('Nome da lista')
  })

  it('detecta divergência entre item_count e items.length', () => {
    const model = normalizeSaleReadModel({
      items: [makeItem(), makeItem({ id: 'item-2', position: 2, course_id: 'course-2' })],
      item_count: 3
    })

    expect(model.item_count).toBe(3)
    expect(model.items).toHaveLength(2)
    expect(model.item_count_matches_items).toBe(false)
  })

  it('aceita payload sem item_count sem mascarar os itens disponíveis', () => {
    const model = normalizeSaleReadModel({ items: [makeItem()] })

    expect(model.item_count).toBe(1)
    expect(model.item_count_matches_items).toBe(true)
  })

  it('aplica a mesma regra de filtro por curso do list_sales', () => {
    const item = makeItem({ course_id: 'course-2' })
    const sale = { course_id: 'course-legacy', items: [item] }

    expect(saleMatchesCourseFilter(sale, null)).toBe(true)
    expect(saleMatchesCourseFilter(sale, 'course-legacy')).toBe(true)
    expect(saleMatchesCourseFilter(sale, 'course-2')).toBe(true)
    expect(saleMatchesCourseFilter(sale, 'course-inexistente')).toBe(false)
  })

  it('mantém rótulos legíveis para os tipos comerciais existentes', () => {
    expect(formatSaleCommercialType('LEGACY')).toBe('Histórico')
    expect(formatSaleCommercialType('COURSE')).toBe('Curso regular')
    expect(formatSaleCommercialType('ONLINE_CATALOG')).toBe('Catálogo online')
  })
})
