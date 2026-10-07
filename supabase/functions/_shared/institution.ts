import type { InstitutionSnapshot } from './contract-document.ts'

type Env = { get(name: string): string | undefined }

export function getInstitutionSnapshot(env: Env): InstitutionSnapshot {
  const pending = 'CONFIGURATION_PENDING'
  return {
    legalName: env.get('INSTITUTION_LEGAL_NAME') ?? 'Profissionaliza Gestão',
    tradeName: env.get('INSTITUTION_TRADE_NAME') ?? 'Profissionaliza Gestão',
    cnpj: env.get('INSTITUTION_CNPJ') ?? pending,
    address: env.get('INSTITUTION_ADDRESS') ?? pending,
    city: env.get('INSTITUTION_CITY') ?? pending,
    state: env.get('INSTITUTION_STATE') ?? pending,
    contact: env.get('INSTITUTION_CONTACT') ?? pending
  }
}
