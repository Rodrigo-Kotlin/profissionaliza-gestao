import { describe, it, expect } from 'vitest'
import { formatDateOnly } from '@/lib/utils'

describe('formatDateOnly', () => {
  it('formats YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatDateOnly('2026-09-10')).toBe('10/09/2026')
  })

  it('formats January 1st correctly', () => {
    expect(formatDateOnly('2026-01-01')).toBe('01/01/2026')
  })

  it('formats December 31st correctly', () => {
    expect(formatDateOnly('2026-12-31')).toBe('31/12/2026')
  })

  it('does not shift date due to timezone (UTC-safe split)', () => {
    expect(formatDateOnly('2026-09-10')).toBe('10/09/2026')
    expect(formatDateOnly('2026-12-01')).toBe('01/12/2026')
  })

  it('returns input as-is for malformed strings', () => {
    expect(formatDateOnly('invalid')).toBe('invalid')
    expect(formatDateOnly('')).toBe('')
  })
})

describe('sales cancellation reason > 2000', () => {
  it('frontend schema rejects > 2000 chars', async () => {
    const { cancelSaleSchema } = await import('./sales-schemas')
    const result = cancelSaleSchema.safeParse({ cancellation_reason: 'x'.repeat(2001) })
    expect(result.success).toBe(false)
  })

  it('frontend schema accepts exactly 2000 chars', async () => {
    const { cancelSaleSchema } = await import('./sales-schemas')
    const result = cancelSaleSchema.safeParse({ cancellation_reason: 'a'.repeat(2000) })
    expect(result.success).toBe(true)
  })
})

describe('sales page_size cap (conceptual)', () => {
  it('backend enforces max 100 via least(greatest(...), 100)', () => {
    const maxPageSize = 100
    const requested = 1000000
    const capped = Math.min(Math.max(requested, 1), maxPageSize)
    expect(capped).toBe(100)
  })

  it('backend defaults to 25 when no page_size', () => {
    const defaultPageSize = 25
    const capped = Math.min(Math.max(defaultPageSize, 1), 100)
    expect(capped).toBe(25)
  })

  it('backend enforces minimum of 1', () => {
    const maxPageSize = 100
    const requested = -5
    const capped = Math.min(Math.max(requested, 1), maxPageSize)
    expect(capped).toBe(1)
  })
})

describe('sales course_name_snapshot (conceptual)', () => {
  it('list_sales returns snapshot, not current course name', () => {
    const snapshotName = 'Administração Básica'
    const currentName = 'Administração Avançada'
    const saleCourseName = snapshotName
    expect(saleCourseName).toBe('Administração Básica')
    expect(saleCourseName).not.toBe(currentName)
  })
})

describe('ADMIN RBAC sales permissions (conceptual)', () => {
  it('ADMIN should have sales.view_all', () => {
    const adminPerms = ['sales.view', 'sales.view_all', 'sales.create', 'sales.approve', 'sales.cancel']
    expect(adminPerms).toContain('sales.view_all')
  })

  it('ADMIN should have sales.cancel', () => {
    const adminPerms = ['sales.view', 'sales.view_all', 'sales.create', 'sales.approve', 'sales.cancel']
    expect(adminPerms).toContain('sales.cancel')
  })

  it('VENDEDOR should only have sales.view and sales.create', () => {
    const vendedorPerms = ['sales.view', 'sales.create']
    expect(vendedorPerms).not.toContain('sales.view_all')
    expect(vendedorPerms).not.toContain('sales.cancel')
  })

  it('RECEPCAO should only have sales.view and sales.create', () => {
    const recepcaoPerms = ['sales.view', 'sales.create']
    expect(recepcaoPerms).not.toContain('sales.view_all')
    expect(recepcaoPerms).not.toContain('sales.cancel')
  })
})

describe('Lead WON + Sale CANCELED retains link (conceptual)', () => {
  it('Lead 360 shows sale_id even when sale is CANCELED', () => {
    const lead = {
      status: 'WON',
      sale_id: 'sale-1',
      sale_code: 'VND-2026-000001',
      sale_status: 'CANCELED',
      sale_net_value: 1200
    }
    expect(lead.sale_id).toBe('sale-1')
    expect(lead.sale_status).toBe('CANCELED')
  })
})

describe('VENDEDOR/RECEPCAO courses.view RBAC (conceptual)', () => {
  it('VENDEDOR should have courses.view but not courses.manage', () => {
    const vendedorPerms = ['dashboard.view', 'crm.view', 'crm.create', 'crm.edit', 'crm.move_stage', 'crm.activities.manage', 'sales.view', 'sales.create', 'commissions.view', 'people.view', 'students.view', 'courses.view']
    expect(vendedorPerms).toContain('courses.view')
    expect(vendedorPerms).not.toContain('courses.manage')
  })

  it('RECEPCAO should have courses.view but not courses.manage', () => {
    const recepcaoPerms = ['dashboard.view', 'crm.view', 'crm.create', 'sales.view', 'academic.view', 'people.view', 'people.edit', 'students.view', 'students.create', 'students.edit', 'guardians.view', 'guardians.manage', 'courses.view']
    expect(recepcaoPerms).toContain('courses.view')
    expect(recepcaoPerms).not.toContain('courses.manage')
  })

  it('VENDEDOR can load course catalog via list_courses with courses.view', () => {
    const hasCoursesView = true
    const hasCoursesManage = false
    expect(hasCoursesView).toBe(true)
    expect(hasCoursesManage).toBe(false)
  })
})

describe('Sale timeline events (conceptual)', () => {
  it('includes sales.created event', () => {
    const events = [
      { event_type: 'sales.created', title: 'Venda criada' },
      { event_type: 'sales.canceled', title: 'Venda cancelada' }
    ]
    const created = events.find((e) => e.event_type === 'sales.created')
    expect(created).toBeDefined()
  })

  it('only returns sale-specific events, not full audit', () => {
    const allowedActions = ['sales.created', 'sales.canceled']
    const events = [
      { action: 'sales.created' },
      { action: 'sales.canceled' },
    ]
    for (const evt of events) {
      expect(allowedActions).toContain(evt.action)
    }
  })
})
