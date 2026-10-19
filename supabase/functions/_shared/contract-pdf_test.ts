import { buildContractDocumentPayload, type ContractDocumentContract, type InstitutionSnapshot, sha256Hex } from './contract-document.ts'
import { renderContractPdf } from './contract-pdf.ts'

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
  contract_id: 'contract-1', contract_code: 'CTR-2026-000001', status: 'DRAFT',
  student_code: 'ALU-2026-000001', student_name: 'Aluno Teste', contractor_name: 'Contratante Teste',
  contractor_cpf: '11144477735', contractor_phone: null, contractor_email: null, contractor_address: null,
  course_name_snapshot: 'Curso Teste', course_workload_snapshot: 120, course_modality_snapshot: 'PRESENCIAL',
  gross_value_snapshot: 1200, discount_value_snapshot: 100, net_value_snapshot: 1100,
  payment_method_snapshot: 'PIX', installments_snapshot: 1, commercial_notes_snapshot: null,
  contract_notes: null, created_at: '2026-10-07T12:00:00.000Z', issued_at: null
}

Deno.test('renderContractPdf gera bytes PDF e hash SHA-256', async () => {
  const payload = buildContractDocumentPayload(contract, institution, 1, 'DOC-CTR-2026-000001-V01')
  const bytes = await renderContractPdf(payload)
  const header = new TextDecoder().decode(bytes.slice(0, 5))
  if (header !== '%PDF-') throw new Error('PDF header is invalid')
  if (bytes.byteLength < 1000) throw new Error('PDF is unexpectedly small')
  const hash = await sha256Hex(bytes)
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error('PDF hash is invalid')
})
