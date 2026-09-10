import { describe, it, expect } from 'vitest'
import { generateSaleCode, formatSaleCode, canCloseSale, isSaleEligibleStage } from './sales-utils'
import type { CrmLeadDetail } from '../crm/crm-types'

const baseLead: CrmLeadDetail = {
  id: 'lead-1',
  lead_code: 'LEAD-2026-000001',
  person_id: 'person-1',
  full_name: 'Maria Silva',
  phone: null,
  whatsapp: null,
  email: null,
  stage_id: 'stage-1',
  stage_code: 'NEGOTIATION',
  stage_name: 'Negociação',
  source_id: null,
  source_name: null,
  course_interest_id: 'course-1',
  course_name: 'Administração',
  owner_user_id: 'user-1',
  owner_name: 'João',
  status: 'OPEN',
  temperature: 'HOT',
  qualification_start_period: null,
  preferred_shift: null,
  preferred_modality: null,
  budget_notes: null,
  decision_maker: null,
  source_detail: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  estimated_value: 1500,
  proposed_value: 1200,
  proposal_sent_at: null,
  commercial_notes: null,
  lost_reason_id: null,
  lost_reason_name: null,
  lost_notes: null,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
  closed_at: null,
  days_in_pipeline: 30,
  sale_id: null,
  sale_code: null,
  sale_status: null,
  sale_net_value: null,
  sale_created_at: null,
  next_activity: null
}

describe('generateSaleCode', () => {
  it('generates VND-YYYY-NNNNNN format', () => {
    expect(generateSaleCode(2026, 1)).toBe('VND-2026-000001')
  })

  it('pads sequence to 6 digits', () => {
    expect(generateSaleCode(2026, 42)).toBe('VND-2026-000042')
    expect(generateSaleCode(2026, 123456)).toBe('VND-2026-123456')
  })
})

describe('formatSaleCode', () => {
  it('returns code as-is', () => {
    expect(formatSaleCode('VND-2026-000001')).toBe('VND-2026-000001')
  })
})

describe('isSaleEligibleStage', () => {
  it('returns true for PROPOSAL_SENT', () => {
    expect(isSaleEligibleStage('PROPOSAL_SENT')).toBe(true)
  })

  it('returns true for NEGOTIATION', () => {
    expect(isSaleEligibleStage('NEGOTIATION')).toBe(true)
  })

  it('returns false for NEW_LEAD', () => {
    expect(isSaleEligibleStage('NEW_LEAD')).toBe(false)
  })

  it('returns false for QUALIFIED', () => {
    expect(isSaleEligibleStage('QUALIFIED')).toBe(false)
  })

  it('returns false for PROSPECTING', () => {
    expect(isSaleEligibleStage('PROSPECTING')).toBe(false)
  })
})

describe('canCloseSale', () => {
  const ownerPermissions = ['sales.create', 'crm.view'] as const
  const viewerPermissions = ['crm.view'] as const
  const viewAllPermissions = ['sales.create', 'crm.view', 'crm.view_all'] as const

  it('returns true when owner has sales.create and eligible stage', () => {
    expect(canCloseSale(baseLead, ownerPermissions, 'user-1')).toBe(true)
  })

  it('returns true when non-owner has crm.view_all and sales.create', () => {
    expect(canCloseSale(baseLead, viewAllPermissions, 'user-2')).toBe(true)
  })

  it('returns false when lead status is not OPEN', () => {
    const lead = { ...baseLead, status: 'WON' as const }
    expect(canCloseSale(lead, ownerPermissions, 'user-1')).toBe(false)
  })

  it('returns false when stage is not eligible', () => {
    const lead = { ...baseLead, stage_code: 'QUALIFIED' }
    expect(canCloseSale(lead, ownerPermissions, 'user-1')).toBe(false)
  })

  it('returns false when user lacks sales.create', () => {
    expect(canCloseSale(baseLead, viewerPermissions, 'user-1')).toBe(false)
  })

  it('returns false when non-owner lacks crm.view_all', () => {
    expect(canCloseSale(baseLead, ['sales.create'] as const, 'user-2')).toBe(false)
  })
})
