export type ContractStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'CANCELED'

export type ContractCourseModality = 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'

export type ContractorAddressSnapshot = {
  postal_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string | null
}

export type ContractListItem = {
  contract_id: string
  contract_code: string
  status: ContractStatus
  student_id: string
  student_code: string
  student_name: string
  contractor_name: string
  course_name: string
  seller_user_id: string
  seller_name: string
  net_value_snapshot: number
  created_at: string
  issued_at: string | null
  signed_at: string | null
}

export type ContractDetail = {
  contract_id: string
  contract_code: string
  status: ContractStatus
  sale_id: string
  sale_code: string
  sale_status: string
  seller_user_id: string
  seller_name: string
  course_id: string
  student_id: string
  student_code: string
  student_name: string
  contractor_person_id: string
  contractor_name: string
  contractor_cpf: string | null
  contractor_phone: string | null
  contractor_email: string | null
  contractor_address: ContractorAddressSnapshot | null
  course_name_snapshot: string
  course_workload_snapshot: number | null
  course_modality_snapshot: ContractCourseModality
  gross_value_snapshot: number
  discount_value_snapshot: number
  net_value_snapshot: number
  payment_method_snapshot: string
  installments_snapshot: number
  commercial_notes_snapshot: string | null
  contract_notes: string | null
  created_at: string
  updated_at: string
  issued_at: string | null
  signed_at: string | null
  signature_confirmed_by: string | null
  canceled_at: string | null
  canceled_by: string | null
  canceled_by_name: string | null
  cancellation_reason: string | null
  created_by: string
  created_by_name: string | null
  sensitive: boolean
}

export type ContractListParams = {
  search?: string
  status?: string
  seller_user_id?: string
  course_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export type ContractListResponse = {
  data: ContractListItem[]
  total: number
  page: number
  page_size: number
}

export type ContractTimelineEvent = {
  id: string
  event_type: string
  occurred_at: string
  title: string
  description: string | null
  actor_user_id: string | null
  actor_name: string | null
  metadata: Record<string, unknown>
}

export type ContractTimelineResponse = {
  data: ContractTimelineEvent[]
  total: number
}

export type ContractorSearchResult = {
  id: string
  full_name: string
  preferred_name: string | null
  cpf_masked: string | null
  phone_masked: string | null
  email_masked: string | null
}

export type ContractorSearchResponse = {
  data: ContractorSearchResult[]
  total: number
}

export type CreatePersonResult = {
  person_id: string
  reused: boolean
}

export type CreateContractResult = {
  contract_id: string
  contract_code: string
  status: ContractStatus
}

export type PersonFormPayload = {
  full_name: string
  preferred_name?: string
  cpf?: string
  rg?: string
  birth_date?: string
  email?: string
  phone?: string
  whatsapp?: string
  postal_code?: string
  street?: string
  number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  notes?: string
}