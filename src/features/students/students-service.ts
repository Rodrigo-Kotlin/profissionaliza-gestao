import { supabase } from '@/lib/supabase'
import { normalizeCep, normalizeCpf, normalizeEmail, normalizePhone } from './students-utils'
import type {
  Guardian,
  GuardianInput,
  StudentDetail,
  StudentHistoryEvent,
  StudentKpi,
  StudentListParams,
  StudentListResponse
} from './students-types'

const FH = (v: string | undefined) => (v === '' ? undefined : v)

export const studentsService = {
  async list(params: StudentListParams): Promise<StudentListResponse> {
    const { data, error } = await supabase.rpc('search_students', {
      p_query: FH(params.query),
      p_status: FH(params.status),
      p_origin: FH(params.origin),
      p_page: params.page ?? 1,
      p_page_size: params.pageSize ?? 20,
      p_sort: params.sort ?? 'full_name',
      p_sort_dir: params.sortDir ?? 'ASC'
    })
    if (error) throw error
    return data as unknown as StudentListResponse
  },

  async detail(studentId: string): Promise<StudentDetail> {
    const { data, error } = await supabase.rpc('get_student_detail', { p_student_id: studentId })
    if (error) throw error
    return data as unknown as StudentDetail
  },

  async create(input: StudentFormPayload): Promise<string> {
    const { data, error } = await supabase.rpc('create_student', {
      p_full_name: input.full_name,
      p_preferred_name: FH(input.preferred_name),
      p_cpf: input.cpf ? normalizeCpf(input.cpf) : undefined,
      p_rg: FH(input.rg),
      p_birth_date: FH(input.birth_date),
      p_email: input.email ? normalizeEmail(input.email) : undefined,
      p_phone: input.phone ? normalizePhone(input.phone) : undefined,
      p_whatsapp: input.whatsapp ? normalizePhone(input.whatsapp) : undefined,
      p_postal_code: input.postal_code ? normalizeCep(input.postal_code) : undefined,
      p_street: FH(input.street),
      p_number: FH(input.number),
      p_complement: FH(input.complement),
      p_district: FH(input.district),
      p_city: FH(input.city),
      p_state: FH(input.state),
      p_emergency_contact_name: FH(input.emergency_contact_name),
      p_emergency_contact_phone: input.emergency_contact_phone ? normalizePhone(input.emergency_contact_phone) : undefined,
      p_notes: FH(input.notes),
      p_origin: input.origin
    })
    if (error) throw error
    return data as unknown as string
  },

  async update(studentId: string, input: StudentUpdatePayload): Promise<void> {
    const { error } = await supabase.rpc('update_student', {
      p_student_id: studentId,
      p_full_name: input.full_name,
      p_preferred_name: FH(input.preferred_name),
      p_birth_date: FH(input.birth_date),
      p_email: input.email ? normalizeEmail(input.email) : undefined,
      p_phone: input.phone ? normalizePhone(input.phone) : undefined,
      p_whatsapp: input.whatsapp ? normalizePhone(input.whatsapp) : undefined,
      p_postal_code: input.postal_code ? normalizeCep(input.postal_code) : undefined,
      p_street: FH(input.street),
      p_number: FH(input.number),
      p_complement: FH(input.complement),
      p_district: FH(input.district),
      p_city: FH(input.city),
      p_state: FH(input.state),
      p_emergency_contact_name: FH(input.emergency_contact_name),
      p_emergency_contact_phone: input.emergency_contact_phone ? normalizePhone(input.emergency_contact_phone) : undefined,
      p_notes: FH(input.notes),
      p_origin: input.origin
    })
    if (error) throw error
  },

  async changeStatus(studentId: string, newStatus: string, reason?: string) {
    const { error } = await supabase.rpc('change_student_status', {
      p_student_id: studentId,
      p_new_status: newStatus,
      p_reason: FH(reason)
    })
    if (error) throw error
  },

  async listGuardians(studentId: string): Promise<Guardian[]> {
    const { data, error } = await supabase.rpc('list_guardians', { p_student_id: studentId })
    if (error) throw error
    return data as unknown as Guardian[]
  },

  async linkGuardian(studentId: string, input: GuardianInput): Promise<string> {
    const { data, error } = await supabase.rpc('link_guardian', {
      p_student_id: studentId,
      p_full_name: input.full_name,
      p_cpf: input.cpf ? normalizeCpf(input.cpf) : undefined,
      p_relationship: input.relationship,
      p_phone: input.phone ? normalizePhone(input.phone) : undefined,
      p_whatsapp: input.whatsapp ? normalizePhone(input.whatsapp) : undefined,
      p_email: input.email ? normalizeEmail(input.email) : undefined,
      p_is_primary_contact: input.is_primary_contact,
      p_is_financial_responsible: input.is_financial_responsible,
      p_is_legal_guardian: input.is_legal_guardian,
      p_notes: FH(input.notes)
    })
    if (error) throw error
    return data as unknown as string
  },

  async unlinkGuardian(guardianId: string) {
    const { error } = await supabase.rpc('unlink_guardian', { p_guardian_id: guardianId })
    if (error) throw error
  },

  async history(studentId: string): Promise<StudentHistoryEvent[]> {
    const { data, error } = await supabase.rpc('get_student_history', { p_student_id: studentId })
    if (error) throw error
    return data as unknown as StudentHistoryEvent[]
  },

  async kpis(): Promise<StudentKpi> {
    const { data, error } = await supabase.rpc('student_kpis')
    if (error) throw error
    return data as unknown as StudentKpi
  },

  async searchLight(query: string): Promise<StudentListResponse> {
    const { data, error } = await supabase.rpc('search_students', {
      p_query: FH(query),
      p_page: 1,
      p_page_size: 8,
      p_sort: 'full_name',
      p_sort_dir: 'ASC'
    })
    if (error) throw error
    return data as unknown as StudentListResponse
  }
}

type StudentFormPayload = {
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
  origin?: string
}

type StudentUpdatePayload = Omit<StudentFormPayload, 'cpf' | 'rg'>