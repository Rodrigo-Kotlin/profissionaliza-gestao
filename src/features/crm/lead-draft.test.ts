import { describe, it, expect, beforeEach } from 'vitest'
import { saveLeadDraft, loadLeadDraft, clearLeadDraft } from './lead-draft'

describe('lead-draft v2 (versioned envelope)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('persiste rascunho em envelope versionado com created_at', () => {
    saveLeadDraft({ full_name: 'Ana', source_code: 'OUTRO' })
    const raw = sessionStorage.getItem('crm:lead-draft:v2')
    expect(raw).toBeTruthy()
    const envelope = JSON.parse(raw as string)
    expect(envelope.version).toBe(2)
    expect(typeof envelope.created_at).toBe('string')
    expect(envelope.values).toMatchObject({ full_name: 'Ana', source_code: 'OUTRO' })
  })

  it('carrega apenas rascunhos com versão v2', () => {
    saveLeadDraft({ full_name: 'Ana' })
    expect(loadLeadDraft()).toMatchObject({ full_name: 'Ana' })
  })

  it('ignora e remove rascunho legado v1 (invalidado)', () => {
    sessionStorage.setItem('crm:lead-draft:v1', JSON.stringify({ full_name: 'Maria', email: 'maria@email.com' }))
    expect(loadLeadDraft()).toBeNull()
    expect(sessionStorage.getItem('crm:lead-draft:v1')).toBeNull()
  })

  it('ignora e remove envelopes com versão incorreta', () => {
    sessionStorage.setItem('crm:lead-draft:v2', JSON.stringify({ version: 1, created_at: 'x', values: { full_name: 'Ana' } }))
    expect(loadLeadDraft()).toBeNull()
    expect(sessionStorage.getItem('crm:lead-draft:v2')).toBeNull()
  })

  it('retorna null para JSON inválido', () => {
    sessionStorage.setItem('crm:lead-draft:v2', 'not-json')
    expect(loadLeadDraft()).toBeNull()
  })

  it('clear remove o rascunho atual e também o legado', () => {
    saveLeadDraft({ full_name: 'Ana' })
    sessionStorage.setItem('crm:lead-draft:v1', JSON.stringify({ full_name: 'Maria' }))
    clearLeadDraft()
    expect(sessionStorage.getItem('crm:lead-draft:v2')).toBeNull()
    expect(sessionStorage.getItem('crm:lead-draft:v1')).toBeNull()
  })
})