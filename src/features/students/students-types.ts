import type { StudentStatus } from '@/lib/rbac'

export type StudentListItem = {
  student_id: string
  student_code: string
  full_name: string
  cpf: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  origin: string | null
  status: StudentStatus
  registration_date: string
}

export type StudentListResponse = {
  data: StudentListItem[]
  total: number
  sensitive: boolean
}

export enum ProfileKind {
  Student = 'student'
}

export type StudentDetail = {
  student_id: string
  person_id: string
  student_code: string
  status: StudentStatus
  registration_date: string
  origin: string | null
  full_name: string
  preferred_name: string | null
  birth_date: string | null
  cpf: string | null
  rg: string | null
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
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  is_active: boolean
  sensitive: boolean
}

export type Guardian = {
  guardian_id: string
  person_id: string
  full_name: string
  relationship: string
  is_primary_contact: boolean
  is_financial_responsible: boolean
  is_legal_guardian: boolean
  phone: string | null
  whatsapp: string | null
  email: string | null
}

export type GuardianInput = {
  full_name: string
  cpf?: string
  relationship: string
  phone?: string
  whatsapp?: string
  email?: string
  is_primary_contact: boolean
  is_financial_responsible: boolean
  is_legal_guardian: boolean
  notes?: string
}

export type StudentKpi = {
  active: number
  new_month: number
  pre_registered: number
  inactive: number
  total: number
}

export type StudentHistoryEvent = {
  changed_at: string
  type: string
  title: string
  detail: string
}

export type StudentSort = 'full_name' | 'registration_date' | 'status' | 'student_code'
export type SortDirection = 'ASC' | 'DESC'

export type StudentListParams = {
  query?: string
  status?: string
  origin?: string
  page?: number
  pageSize?: number
  sort?: StudentSort
  sortDir?: SortDirection
}