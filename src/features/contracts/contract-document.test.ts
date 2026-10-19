import { describe, expect, it } from 'vitest'
import {
  buildContractDocumentPayload,
  canonicalize,
  CONTRACT_TEMPLATE_VERSION,
  type ContractDocumentContract,
  type InstitutionSnapshot
} from '../../../supabase/functions/_shared/contract-document'

const institution: InstitutionSnapshot = {
  legalName: 'Instituição Teste',
  tradeName: 'Instituição Teste',
  cnpj: 'CONFIGURATION_PENDING',
  address: 'CONFIGURATION_PENDING',
  city: 'Santarém',
  state: 'PA',
  contact: 'CONFIGURATION_PENDING'
}

const contract: ContractDocumentContract = {
  contract_id: 'contract-1',
  contract_code: 'CTR-2026-000001',
  status: 'DRAFT',
  student_code: 'ALU-2026-000001',
  student_name: 'Aluno Teste',
  contractor_name: 'Contratante Teste',
  contractor_cpf: '11144477735',
  contractor_phone: '5591999999999',
  contractor_email: 'teste@example.test',
  contractor_address: { postal_code: '68000000', street: 'Rua Teste', number: '10', complement: null, district: 'Centro', city: 'Santarém', state: 'PA', country: 'Brasil' },
  course_name_snapshot: 'Curso Teste',
  course_workload_snapshot: 120,
  course_modality_snapshot: 'PRESENCIAL',
  gross_value_snapshot: 1200,
  discount_value_snapshot: 100,
  net_value_snapshot: 1100,
  payment_method_snapshot: 'PIX',
  installments_snapshot: 1,
  commercial_notes_snapshot: 'Observação comercial',
  contract_notes: null,
  created_at: '2026-10-07T12:00:00.000Z',
  issued_at: null
}

describe('contract document payload', () => {
  it('preserva snapshots, versão e dados comerciais necessários', () => {
    const payload = buildContractDocumentPayload(contract, institution, 1, 'DOC-CTR-2026-000001-V01')
    expect(payload.document.templateVersion).toBe(CONTRACT_TEMPLATE_VERSION)
    expect(payload.contractor.cpf).toBe(contract.contractor_cpf)
    expect(payload.student.code).toBe(contract.student_code)
    expect(payload.course.name).toBe(contract.course_name_snapshot)
    expect(payload.commercial.netValue).toBe(contract.net_value_snapshot)
    expect(payload.commercial.installments).toBe(1)
    expect(payload.clauses.status).toBe('LEGAL_TEXT_PENDING_APPROVAL')
  })

  it('canonicaliza a mesma estrutura independentemente da ordem das propriedades', () => {
    const left = canonicalize({ b: 2, a: { z: true, y: 1 }, list: [{ b: 2, a: 1 }] })
    const right = canonicalize({ list: [{ a: 1, b: 2 }], a: { y: 1, z: true }, b: 2 })
    expect(left).toBe(right)
  })
})
