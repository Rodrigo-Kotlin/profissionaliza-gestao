import { describe, it, expect } from 'vitest'
import { cancelContractSchema, createContractSchema, editDraftSchema, personFormSchema } from './contracts-schemas'

describe('createContractSchema', () => {
  it('aceita input válido', () => {
    const result = createContractSchema.safeParse({ contractor_person_id: 'person-1' })
    expect(result.success).toBe(true)
  })

  it('aceita notas opcionais', () => {
    const result = createContractSchema.safeParse({ contractor_person_id: 'person-1', contract_notes: 'Cláusula de teste' })
    expect(result.success).toBe(true)
  })

  it('rejeita contratante vazio', () => {
    const result = createContractSchema.safeParse({ contractor_person_id: '' })
    expect(result.success).toBe(false)
  })
})

describe('editDraftSchema', () => {
  it('aceita contratante e notas', () => {
    const result = editDraftSchema.safeParse({ contractor_person_id: 'person-1', contract_notes: 'Notas' })
    expect(result.success).toBe(true)
  })

  it('rejeita contratante ausente', () => {
    const result = editDraftSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('cancelContractSchema', () => {
  it('aceita motivo válido', () => {
    const result = cancelContractSchema.safeParse({ cancellation_reason: 'Contratante desistiu' })
    expect(result.success).toBe(true)
  })

  it('rejeita motivo vazio ou somente espaços', () => {
    expect(cancelContractSchema.safeParse({ cancellation_reason: '' }).success).toBe(false)
    expect(cancelContractSchema.safeParse({ cancellation_reason: '   ' }).success).toBe(false)
  })

  it('rejeita motivo acima de 2000 chars e aceita exatamente 2000', () => {
    expect(cancelContractSchema.safeParse({ cancellation_reason: 'a'.repeat(2001) }).success).toBe(false)
    expect(cancelContractSchema.safeParse({ cancellation_reason: 'a'.repeat(2000) }).success).toBe(true)
  })
})

describe('personFormSchema', () => {
  it('aceita dados mínimos', () => {
    const result = personFormSchema.safeParse({ full_name: 'Maria Silva' })
    expect(result.success).toBe(true)
  })

  it('rejeita nome curto', () => {
    const result = personFormSchema.safeParse({ full_name: 'Ma' })
    expect(result.success).toBe(false)
  })

  it('valida CPF quando informado', () => {
    // 52998224725 é um CPF válido de teste
    const ok = personFormSchema.safeParse({ full_name: 'Maria Silva', cpf: '52998224725' })
    expect(ok.success).toBe(true)
    const bad = personFormSchema.safeParse({ full_name: 'Maria Silva', cpf: '123' })
    expect(bad.success).toBe(false)
  })

  it('valida telefone mínimo de 10 dígitos', () => {
    const ok = personFormSchema.safeParse({ full_name: 'Maria Silva', phone: '11999999999' })
    expect(ok.success).toBe(true)
    const bad = personFormSchema.safeParse({ full_name: 'Maria Silva', phone: '12345' })
    expect(bad.success).toBe(false)
  })

  it('valida e-mail quando informado', () => {
    const ok = personFormSchema.safeParse({ full_name: 'Maria Silva', email: 'maria@exemplo.com' })
    expect(ok.success).toBe(true)
    const bad = personFormSchema.safeParse({ full_name: 'Maria Silva', email: 'invalido' })
    expect(bad.success).toBe(false)
  })
})