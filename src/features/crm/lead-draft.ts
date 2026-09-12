import type { LeadFormInput } from './crm-schemas'

const LEAD_DRAFT_KEY = 'crm:lead-draft:v2'
const LEAD_DRAFT_LEGACY_KEYS = ['crm:lead-draft:v1']
const LEAD_DRAFT_VERSION = 2

type LeadDraftEnvelope = {
  version: number
  created_at: string
  values: Partial<LeadFormInput>
}

export function saveLeadDraft(values: Partial<LeadFormInput>): void {
  try {
    const envelope: LeadDraftEnvelope = {
      version: LEAD_DRAFT_VERSION,
      created_at: new Date().toISOString(),
      values
    }
    sessionStorage.setItem(LEAD_DRAFT_KEY, JSON.stringify(envelope))
  } catch {
    return
  }
}

export function loadLeadDraft(): Partial<LeadFormInput> | null {
  try {
    cleanupLegacyDrafts()
    const raw = sessionStorage.getItem(LEAD_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LeadDraftEnvelope>
    if (
      !parsed ||
      parsed.version !== LEAD_DRAFT_VERSION ||
      typeof parsed.values !== 'object' ||
      parsed.values === null
    ) {
      sessionStorage.removeItem(LEAD_DRAFT_KEY)
      return null
    }
    return parsed.values as Partial<LeadFormInput>
  } catch {
    return null
  }
}

export function clearLeadDraft(): void {
  try {
    sessionStorage.removeItem(LEAD_DRAFT_KEY)
    cleanupLegacyDrafts()
  } catch {
    return
  }
}

function cleanupLegacyDrafts(): void {
  try {
    for (const key of LEAD_DRAFT_LEGACY_KEYS) {
      sessionStorage.removeItem(key)
    }
  } catch {
    return
  }
}