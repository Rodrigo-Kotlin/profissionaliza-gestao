import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { CrmLeadListParams, CrmLeadDetail, CrmLeadListResponse, CrmPipelineResponse, CrmActivityAgendaResponse, CrmDashboardKpis, Course, CrmPipelineStage, CrmTimelineResponse, CrmLeadActivitiesResponse } from './crm-types'

type Functions = Database['public']['Functions']

type RpcArgs<K extends keyof Functions> = Functions[K] extends { Args: infer A } ? A : Record<string, never>
type RpcReturns<K extends keyof Functions> = Functions[K] extends { Returns: infer R } ? R : unknown

// RPC helper — usa as assinaturas geradas de database.types.ts
// (Database['public']['Functions']) em vez de `any` irrestrito.
async function rpc<K extends keyof Functions>(
  fn: K,
  args?: RpcArgs<K>
): Promise<{ data: RpcReturns<K> | null; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (supabase.rpc as any)(fn, args ?? {})
  return res as { data: RpcReturns<K> | null; error: unknown }
}

function emptyToUndefined<T>(v: T | '' | null | undefined): T | undefined {
  return v === '' || v === null ? undefined : v
}

export const crmService = {
  async listPipeline(ownerUserId?: string): Promise<CrmPipelineResponse> {
    const { data, error } = await rpc('list_crm_pipeline', {
      p_owner_user_id: emptyToUndefined(ownerUserId),
      p_limit: 50
    })
    if (error) throw error
    return data as CrmPipelineResponse
  },

  async searchLeads(params: CrmLeadListParams): Promise<CrmLeadListResponse> {
    const { data, error } = await rpc('search_crm_leads', {
      p_query: emptyToUndefined(params.q),
      p_stage_code: emptyToUndefined(params.stage_code),
      p_owner_user_id: emptyToUndefined(params.owner_user_id),
      p_source_id: emptyToUndefined(params.source_id),
      p_course_interest_id: emptyToUndefined(params.course_interest_id),
      p_temperature: emptyToUndefined(params.temperature),
      p_status: emptyToUndefined(params.status),
      p_overdue_only: params.overdue_only ?? false,
      p_no_activity: params.no_activity ?? false,
      p_page: params.page ?? 1,
      p_page_size: params.page_size ?? 25,
      p_sort: params.sort ?? 'created_at',
      p_sort_dir: params.dir ?? 'DESC'
    })
    if (error) throw error
    return data as CrmLeadListResponse
  },

  async getLeadDetail(leadId: string): Promise<CrmLeadDetail> {
    const { data, error } = await rpc('get_crm_lead_detail', { p_lead_id: leadId })
    if (error) throw error
    return data as CrmLeadDetail
  },

  async createLead(input: {
    full_name: string
    phone?: string
    whatsapp?: string
    email?: string
    source_code?: string
    course_interest_id?: string
    owner_user_id?: string
    stage_id?: string
    temperature?: string
    commercial_notes?: string
    first_activity_title?: string
    first_activity_type?: string
    first_activity_due_at?: string
  }): Promise<string> {
    const { data, error } = await rpc('create_crm_lead', {
      p_full_name: input.full_name,
      p_phone: emptyToUndefined(input.phone),
      p_whatsapp: emptyToUndefined(input.whatsapp),
      p_email: emptyToUndefined(input.email),
      p_source_code: input.source_code ?? 'OUTRO',
      p_course_interest_id: emptyToUndefined(input.course_interest_id),
      p_owner_user_id: emptyToUndefined(input.owner_user_id),
      p_stage_id: emptyToUndefined(input.stage_id),
      p_temperature: emptyToUndefined(input.temperature),
      p_commercial_notes: emptyToUndefined(input.commercial_notes),
      p_first_activity_title: emptyToUndefined(input.first_activity_title),
      p_first_activity_type: emptyToUndefined(input.first_activity_type),
      p_first_activity_due_at: emptyToUndefined(input.first_activity_due_at)
    })
    if (error) throw error
    return data as string
  },

  async updateLead(leadId: string, input: Record<string, unknown>): Promise<void> {
    const { error } = await rpc('update_crm_lead', {
      p_lead_id: leadId,
      p_source_id: emptyToUndefined(input.source_id as string),
      p_course_interest_id: emptyToUndefined(input.course_interest_id as string),
      p_temperature: emptyToUndefined(input.temperature as string),
      p_commercial_notes: emptyToUndefined(input.commercial_notes as string),
      p_qualification_start_period: emptyToUndefined(input.qualification_start_period as string),
      p_preferred_shift: emptyToUndefined(input.preferred_shift as string),
      p_preferred_modality: emptyToUndefined(input.preferred_modality as string),
      p_budget_notes: emptyToUndefined(input.budget_notes as string),
      p_decision_maker: emptyToUndefined(input.decision_maker as string),
      p_source_detail: emptyToUndefined(input.source_detail as string),
      p_estimated_value: emptyToUndefined(input.estimated_value as number),
      p_proposed_value: emptyToUndefined(input.proposed_value as number),
      p_stage_id: emptyToUndefined(input.stage_id as string)
    })
    if (error) throw error
  },

  async moveStage(leadId: string, newStageId: string, reason?: string): Promise<void> {
    const { error } = await rpc('move_crm_lead_stage', {
      p_lead_id: leadId,
      p_new_stage_id: newStageId,
      p_reason: emptyToUndefined(reason)
    })
    if (error) throw error
  },

  async assignLead(leadId: string, newOwnerId: string): Promise<void> {
    const { error } = await rpc('assign_crm_lead', {
      p_lead_id: leadId,
      p_new_owner_id: newOwnerId
    })
    if (error) throw error
  },

  async closeLost(leadId: string, lostReasonId: string, lostNotes?: string): Promise<void> {
    const { error } = await rpc('close_crm_lead_lost', {
      p_lead_id: leadId,
      p_lost_reason_id: lostReasonId,
      p_lost_notes: emptyToUndefined(lostNotes)
    })
    if (error) throw error
  },

  async createActivity(input: {
    lead_id: string
    type: string
    title: string
    description?: string
    due_at: string
    owner_user_id?: string
  }): Promise<string> {
    const { data, error } = await rpc('create_crm_activity', {
      p_lead_id: input.lead_id,
      p_type: input.type,
      p_title: input.title,
      p_description: emptyToUndefined(input.description),
      p_due_at: input.due_at,
      p_owner_user_id: emptyToUndefined(input.owner_user_id)
    })
    if (error) throw error
    return data as string
  },

  async completeActivity(activityId: string, outcome?: string): Promise<void> {
    const { error } = await rpc('complete_crm_activity', {
      p_activity_id: activityId,
      p_outcome: emptyToUndefined(outcome)
    })
    if (error) throw error
  },

  async rescheduleActivity(activityId: string, newDueAt: string): Promise<void> {
    const { error } = await rpc('reschedule_crm_activity', {
      p_activity_id: activityId,
      p_new_due_at: newDueAt
    })
    if (error) throw error
  },

  async getAgenda(params: { owner_user_id?: string; page?: number; page_size?: number } = {}): Promise<CrmActivityAgendaResponse> {
    const { data, error } = await rpc('crm_activity_agenda', {
      p_owner_user_id: emptyToUndefined(params.owner_user_id),
      p_page: params.page ?? 1,
      p_page_size: params.page_size ?? 25
    })
    if (error) throw error
    return data as CrmActivityAgendaResponse
  },

  async getKpis(): Promise<CrmDashboardKpis> {
    const { data, error } = await rpc('crm_dashboard_kpis')
    if (error) throw error
    return data as CrmDashboardKpis
  },

  // p_status === undefined/null => todos os status
  // p_status === 'ACTIVE' => apenas ativos (usado no formulário de Lead)
  async listCourses(status?: string | null): Promise<Course[]> {
    const { data, error } = await rpc('list_courses', {
      p_status: emptyToUndefined(status)
    })
    if (error) throw error
    return data as Course[]
  },

  async createCourse(input: {
    code: string
    name: string
    short_name?: string
    category?: string
    modality: string
    workload_hours?: number
    duration_value?: number
    duration_unit?: string
    default_price?: number
    description?: string
  }): Promise<string> {
    const { data, error } = await rpc('create_course', {
      p_code: input.code,
      p_name: input.name,
      p_short_name: emptyToUndefined(input.short_name),
      p_category: emptyToUndefined(input.category),
      p_modality: input.modality,
      p_workload_hours: emptyToUndefined(input.workload_hours),
      p_duration_value: emptyToUndefined(input.duration_value),
      p_duration_unit: emptyToUndefined(input.duration_unit),
      p_default_price: emptyToUndefined(input.default_price),
      p_description: emptyToUndefined(input.description)
    })
    if (error) throw error
    return data as string
  },

  async updateCourse(
    courseId: string,
    input: {
      name?: string
      short_name?: string
      category?: string
      modality?: string
      workload_hours?: number
      duration_value?: number
      duration_unit?: string
      default_price?: number
      description?: string
      status?: string
    }
  ): Promise<void> {
    const { error } = await rpc('update_course', {
      p_course_id: courseId,
      p_name: emptyToUndefined(input.name),
      p_short_name: emptyToUndefined(input.short_name),
      p_category: emptyToUndefined(input.category),
      p_modality: emptyToUndefined(input.modality),
      p_workload_hours: emptyToUndefined(input.workload_hours),
      p_duration_value: emptyToUndefined(input.duration_value),
      p_duration_unit: emptyToUndefined(input.duration_unit),
      p_default_price: emptyToUndefined(input.default_price),
      p_description: emptyToUndefined(input.description),
      p_status: emptyToUndefined(input.status)
    })
    if (error) throw error
  },

  async searchLeadsLight(query: string): Promise<Array<{ id: string; lead_code: string; full_name: string; course_name: string | null }>> {
    const { data, error } = await rpc('search_crm_leads', {
      p_query: query,
      p_status: 'OPEN',
      p_page: 1,
      p_page_size: 8
    })
    if (error) throw error
    const response = data as CrmLeadListResponse
    return response.data.map((l) => ({
      id: l.id,
      lead_code: l.lead_code,
      full_name: l.full_name,
      course_name: l.course_name
    }))
  },

  async listPipelineStages(): Promise<CrmPipelineStage[]> {
    const { data, error } = await rpc('list_crm_pipeline_stages')
    if (error) throw error
    return data as CrmPipelineStage[]
  },

  async getLeadTimeline(leadId: string, page = 1, pageSize = 50): Promise<CrmTimelineResponse> {
    const { data, error } = await rpc('get_crm_lead_timeline', {
      p_lead_id: leadId,
      p_page: page,
      p_page_size: pageSize
    })
    if (error) throw error
    return data as CrmTimelineResponse
  },

  async listLeadActivities(leadId: string, page = 1, pageSize = 50): Promise<CrmLeadActivitiesResponse> {
    const { data, error } = await rpc('list_crm_lead_activities', {
      p_lead_id: leadId,
      p_page: page,
      p_page_size: pageSize
    })
    if (error) throw error
    return data as CrmLeadActivitiesResponse
  }
}
