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
  enrollment_id?: string | null
  enrollment_code?: string | null
  enrollment_status?: string | null
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

export type ContractDocumentStatus = 'DRAFT' | 'FINAL' | 'SUPERSEDED' | 'VOID'

export type ContractDocumentListItem = {
  document_id: string
  contract_id: string
  document_code: string
  version: number
  document_type: string
  status: ContractDocumentStatus
  template_version: string
  original_file_name: string | null
  original_mime_type: string | null
  original_file_size: number | null
  original_sha256_prefix: string | null
  generated_at: string | null
  issued_at: string | null
  superseded_at: string | null
}

export type ContractDocumentListResponse = {
  data: ContractDocumentListItem[]
  total: number
}

export type GenerateContractDocumentResult = {
  document: ContractDocumentListItem
  idempotent: boolean
}

export type DownloadContractDocumentResult = {
  signed_url: string
  expires_in: number
}

export type ContractExecutionMethod = 'GOV_BR' | 'PHYSICAL'
export type ContractExecutionStatus = 'PENDING_UPLOAD' | 'RECEIVED' | 'VERIFIED' | 'REJECTED'

export type ContractExecution = {
  execution_id: string
  contract_document_id: string
  execution_method: ContractExecutionMethod
  status: ContractExecutionStatus
  signer_person_id: string
  signer_name_snapshot: string
  signed_file_name: string | null
  signed_mime_type: string | null
  signed_file_size: number | null
  signed_sha256: string | null
  signed_at: string | null
  received_at: string | null
  received_by: string | null
  verified_at: string | null
  verified_by: string | null
  verification_method: string | null
  verification_notes?: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export type ContractExecutionListResponse = {
  data: ContractExecution[]
  total: number
}

export type ContractExecutionResult = {
  execution_id: string
  status: ContractExecutionStatus
  signed_sha256?: string
  [key: string]: unknown
}

export type CompleteContractExecutionResult = CreateContractResult & {
  execution_id: string
  enrollment?: { enrollment_id?: string; enrollment_code?: string; status?: string; created?: boolean }
  created: boolean
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

export type ContractorDetail = {
  person_id: string
  full_name: string
  preferred_name: string | null
  cpf: string | null
  rg: string | null
  birth_date: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  postal_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  sensitive: boolean
}

export type UpdatePersonPayload = {
  person_id: string
  full_name?: string
  preferred_name?: string | null
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
