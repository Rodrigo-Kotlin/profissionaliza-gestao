import type { LeadFormInput } from './crm-schemas'

const LEAD_DRAFT_KEY = 'crm:lead-draft:v1'

export function saveLeadDraft(values: Partial<LeadFormInput>): void {
  try {
    sessionStorage.setItem(LEAD_DRAFT_KEY, JSON.stringify(values))
  } catch {
    return
  }
}

export function loadLeadDraft(): Partial<LeadFormInput> | null {
  try {
    const raw = sessionStorage.getItem(LEAD_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<LeadFormInput>
  } catch {
    return null
  }
}

export function clearLeadDraft(): void {
  try {
    sessionStorage.removeItem(LEAD_DRAFT_KEY)
  } catch {
    return
  }
}