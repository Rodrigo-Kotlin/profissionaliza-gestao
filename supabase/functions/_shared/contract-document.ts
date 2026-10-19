export const CONTRACT_TEMPLATE_VERSION = 'CONTRACT_PF_V1'
export const CONTRACT_DOCUMENT_TYPE = 'CONTRACT'
export const LEGAL_TEXT_STATUS = 'LEGAL_TEXT_PENDING_APPROVAL'

export type InstitutionSnapshot = {
  legalName: string
  tradeName: string
  cnpj: string
  address: string
  city: string
  state: string
  contact: string
}

export type ContractDocumentContract = {
  contract_id: string
  contract_code: string
  status: string
  student_code: string
  student_name: string
  contractor_name: string
  contractor_cpf: string | null
  contractor_phone: string | null
  contractor_email: string | null
  contractor_address: {
    postal_code: string | null
    street: string | null
    number: string | null
    complement: string | null
    district: string | null
    city: string | null
    state: string | null
    country: string | null
  } | null
  course_name_snapshot: string
  course_workload_snapshot: number | null
  course_modality_snapshot: string
  gross_value_snapshot: number
  discount_value_snapshot: number
  net_value_snapshot: number
  payment_method_snapshot: string
  installments_snapshot: number
  commercial_notes_snapshot: string | null
  contract_notes: string | null
  created_at: string
  issued_at: string | null
}

export type ContractDocumentPayload = {
  institution: InstitutionSnapshot
  contract: {
    code: string
    date: string
    city: string
    status: string
  }
  contractor: {
    name: string
    cpf: string | null
    phone: string | null
    email: string | null
    address: ContractDocumentContract['contractor_address']
  }
  student: {
    code: string
    name: string
  }
  course: {
    name: string
    modality: string
    workloadHours: number | null
  }
  commercial: {
    grossValue: number
    discountValue: number
    netValue: number
    paymentMethod: string
    installments: number
    notes: string | null
  }
  dates: {
    createdAt: string
    issuedAt: string | null
  }
  document: {
    templateVersion: string
    version: number
    documentCode: string | null
    canonicalPayloadHash: string | null
  }
  clauses: {
    status: typeof LEGAL_TEXT_STATUS
    sections: string[]
  }
  signing: {
    availableMethods: ['GOV_BR', 'PHYSICAL']
    status: 'AWAITING_FORMALIZATION'
  }
}

export function buildContractDocumentPayload(
  contract: ContractDocumentContract,
  institution: InstitutionSnapshot,
  version = 1,
  documentCode: string | null = null
): ContractDocumentPayload {
  const createdDate = contract.created_at.slice(0, 10)
  return {
    institution,
    contract: {
      code: contract.contract_code,
      date: createdDate,
      city: institution.city,
      status: contract.status
    },
    contractor: {
      name: contract.contractor_name,
      cpf: contract.contractor_cpf,
      phone: contract.contractor_phone,
      email: contract.contractor_email,
      address: contract.contractor_address
    },
    student: {
      code: contract.student_code,
      name: contract.student_name
    },
    course: {
      name: contract.course_name_snapshot,
      modality: contract.course_modality_snapshot,
      workloadHours: contract.course_workload_snapshot
    },
    commercial: {
      grossValue: contract.gross_value_snapshot,
      discountValue: contract.discount_value_snapshot,
      netValue: contract.net_value_snapshot,
      paymentMethod: contract.payment_method_snapshot,
      installments: contract.installments_snapshot,
      notes: contract.commercial_notes_snapshot || contract.contract_notes
    },
    dates: {
      createdAt: contract.created_at,
      issuedAt: contract.issued_at
    },
    document: {
      templateVersion: CONTRACT_TEMPLATE_VERSION,
      version,
      documentCode,
      canonicalPayloadHash: null
    },
    clauses: {
      status: LEGAL_TEXT_STATUS,
      sections: []
    },
    signing: {
      availableMethods: ['GOV_BR', 'PHYSICAL'],
      status: 'AWAITING_FORMALIZATION'
    }
  }
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
  return `{${entries.join(',')}}`
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
