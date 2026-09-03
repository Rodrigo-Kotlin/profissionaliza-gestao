export type CrmLeadStatus = 'OPEN' | 'LOST' | 'WON' | 'ARCHIVED'
export type CrmTemperature = 'HOT' | 'WARM' | 'COLD'
export type CrmActivityType = 'CALL' | 'WHATSAPP' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'OTHER'
export type CrmActivityStatus = 'PENDING' | 'COMPLETED' | 'CANCELED'
export type CourseStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type CourseModality = 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO'

export type CrmPipelineStage = {
  id: string
  code: string
  name: string
  position: number
  probability: number | null
  is_active: boolean
}

export type CrmLeadSource = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export type CrmLostReason = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export type Course = {
  id: string
  code: string
  name: string
  short_name: string | null
  category: string | null
  modality: CourseModality
  workload_hours: number | null
  duration_value: number | null
  duration_unit: string | null
  default_price: number | null
  description: string | null
  status: CourseStatus
}

export type CrmLeadCard = {
  id: string
  lead_code: string
  full_name: string
  course_name: string | null
  temperature: CrmTemperature | null
  owner_name: string | null
  owner_user_id: string
  created_at: string
  updated_at: string
  days_in_stage: number
  overdue_activities: number
  pending_activities: number
}

export type CrmPipelineColumn = {
  stage_id: string
  stage_code: string
  stage_name: string
  position: number
  total_count: number
  leads: CrmLeadCard[]
}

export type CrmPipelineResponse = {
  columns: CrmPipelineColumn[]
}

export type CrmLeadListItem = {
  id: string
  lead_code: string
  full_name: string
  phone: string | null
  whatsapp: string | null
  stage_code: string
  stage_name: string
  source_name: string | null
  course_name: string | null
  owner_name: string | null
  owner_user_id: string
  temperature: CrmTemperature | null
  status: CrmLeadStatus
  created_at: string
  updated_at: string
  days_in_pipeline: number
  next_activity_summary: string | null
  next_activity_at: string | null
  overdue_count: number
}

export type CrmLeadListResponse = {
  data: CrmLeadListItem[]
  total: number
}

export type CrmLeadDetail = {
  id: string
  lead_code: string
  person_id: string
  full_name: string
  phone: string | null
  whatsapp: string | null
  email: string | null
  stage_id: string
  stage_code: string
  stage_name: string
  source_id: string | null
  source_name: string | null
  course_interest_id: string | null
  course_name: string | null
  owner_user_id: string
  owner_name: string | null
  status: CrmLeadStatus
  temperature: CrmTemperature | null
  qualification_start_period: string | null
  preferred_shift: string | null
  preferred_modality: string | null
  budget_notes: string | null
  decision_maker: string | null
  source_detail: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  estimated_value: number | null
  proposed_value: number | null
  proposal_sent_at: string | null
  commercial_notes: string | null
  lost_reason_id: string | null
  lost_reason_name: string | null
  lost_notes: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  days_in_pipeline: number
  next_activity: {
    id: string
    type: CrmActivityType
    title: string
    due_at: string
    status: CrmActivityStatus
    is_overdue: boolean
  } | null
}

export type CrmActivity = {
  id: string
  lead_id: string
  lead_code: string
  lead_name: string
  type: CrmActivityType
  title: string
  description: string | null
  due_at: string
  status: CrmActivityStatus
  owner_name: string | null
  owner_user_id: string
  is_overdue: boolean
}

export type CrmActivityAgendaResponse = {
  data: CrmActivity[]
  total: number
}

export type CrmDashboardKpis = {
  new_leads: number
  open_leads: number
  qualified: number
  negotiation: number
  overdue_activities: number
  no_next_action: number
  qualification_rate: number
  total_leads: number
}

export type CrmLeadListParams = {
  q?: string
  stage_code?: string
  owner_user_id?: string
  source_id?: string
  course_interest_id?: string
  temperature?: CrmTemperature
  status?: CrmLeadStatus
  overdue_only?: boolean
  no_activity?: boolean
  page?: number
  page_size?: number
  sort?: string
  dir?: string
}

export type CrmActivityListParams = {
  owner_user_id?: string
  page?: number
  page_size?: number
}
