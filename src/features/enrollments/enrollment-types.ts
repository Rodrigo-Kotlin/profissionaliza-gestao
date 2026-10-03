export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELED'

export type EnrollmentListItem = {
  enrollment_id: string
  enrollment_code: string
  status: EnrollmentStatus
  enrollment_date: string
  student_id: string
  student_code: string
  student_name: string
  course_id: string
  course_code: string
  course_name: string
  sale_id: string
  sale_code: string
  contract_id: string
  contract_code: string
}

export type EnrollmentListParams = {
  q?: string
  status?: EnrollmentStatus | string
  course_id?: string
  student_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export type EnrollmentListResponse = {
  data: EnrollmentListItem[]
  page: number
  page_size: number
  total: number
}

export type EnrollmentRecord = {
  id: string
  enrollment_code: string
  student_id: string
  course_id: string
  sale_id: string
  contract_id: string
  status: EnrollmentStatus
  enrollment_date: string
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  canceled_at: string | null
  cancellation_reason: string | null
  pause_reason: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type EnrollmentDetail = {
  enrollment: EnrollmentRecord
  student: { id: string; student_code: string; name: string; status: string }
  course: { id: string; code: string; name: string; status: string }
  sale: { id: string; sale_code: string; status: string }
  contract: { id: string; contract_code: string; status: string }
}

export type EnrollmentAction = 'activate' | 'pause' | 'resume' | 'complete' | 'cancel'
