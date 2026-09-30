import type { ContractorDetail } from './contracts-types'

export type ContractorField =
  | 'full_name'
  | 'preferred_name'
  | 'birth_date'
  | 'phone'
  | 'whatsapp'
  | 'email'
  | 'postal_code'
  | 'street'
  | 'number'
  | 'complement'
  | 'district'
  | 'city'
  | 'state'

export const CONTRACTOR_FIELD_LABELS: Record<ContractorField, string> = {
  full_name: 'Nome completo',
  preferred_name: 'Nome preferido',
  birth_date: 'Nascimento',
  phone: 'Telefone',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  postal_code: 'CEP',
  street: 'Logradouro',
  number: 'Número',
  complement: 'Complemento',
  district: 'Bairro',
  city: 'Cidade',
  state: 'UF'
}

export type ContractorCompleteness = {
  isComplete: boolean
  cpfMissing: boolean
  missing: ContractorField[]
}

export function getContractorCompleteness(detail: ContractorDetail): ContractorCompleteness {
  const missing: ContractorField[] = []

  if (!detail.full_name) missing.push('full_name')
  if (!detail.phone && !detail.whatsapp && !detail.email) {
    missing.push('phone', 'whatsapp', 'email')
  }
  if (!detail.postal_code) missing.push('postal_code')
  if (!detail.street) missing.push('street')
  if (!detail.number) missing.push('number')
  if (!detail.district) missing.push('district')
  if (!detail.city) missing.push('city')
  if (!detail.state) missing.push('state')

  return {
    isComplete: missing.length === 0,
    cpfMissing: !detail.cpf,
    missing
  }
}