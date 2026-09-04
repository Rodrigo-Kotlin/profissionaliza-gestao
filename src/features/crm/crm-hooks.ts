import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmService } from './crm-service'
import { writeAuditLog } from '@/services/audit-service'
import type { CrmLeadListParams } from './crm-types'

export const crmKeys = {
  all: ['crm'] as const,
  pipeline: (ownerUserId?: string) => ['crm', 'pipeline', ownerUserId] as const,
  leads: (params: CrmLeadListParams) => ['crm', 'leads', params] as const,
  lead: (id: string) => ['crm', 'lead', id] as const,
  agenda: (params?: { owner_user_id?: string }) => ['crm', 'agenda', params] as const,
  kpis: ['crm', 'kpis'] as const,
  courses: (status?: string) => ['crm', 'courses', status] as const
}

export function useCrmPipeline(ownerUserId?: string) {
  return useQuery({
    queryKey: crmKeys.pipeline(ownerUserId),
    queryFn: () => crmService.listPipeline(ownerUserId)
  })
}

export function useCrmLeads(params: CrmLeadListParams) {
  return useQuery({
    queryKey: crmKeys.leads(params),
    queryFn: () => crmService.searchLeads(params)
  })
}

export function useCrmLeadDetail(id: string) {
  return useQuery({
    queryKey: crmKeys.lead(id),
    queryFn: () => crmService.getLeadDetail(id),
    enabled: Boolean(id)
  })
}

export function useCrmAgenda(params?: { owner_user_id?: string }) {
  return useQuery({
    queryKey: crmKeys.agenda(params),
    queryFn: () => crmService.getAgenda(params)
  })
}

export function useCrmKpis() {
  return useQuery({
    queryKey: crmKeys.kpis,
    queryFn: () => crmService.getKpis()
  })
}

export function useCrmCourses(status?: string) {
  return useQuery({
    queryKey: crmKeys.courses(status),
    queryFn: () => crmService.listCourses(status)
  })
}

type CourseCreateInput = {
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
}

type CourseUpdateInput = {
  name?: string
  short_name?: string
  category?: string
  modality?: string
  status?: string
  workload_hours?: number
  duration_value?: number
  duration_unit?: string
  default_price?: number
  description?: string
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CourseCreateInput) => crmService.createCourse(input),
    onSuccess: () => {
      void writeAuditLog('crm.course_created', 'course', undefined, {})
      qc.invalidateQueries({ queryKey: ['crm', 'courses'] })
      qc.invalidateQueries({ queryKey: crmKeys.all })
    }
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ courseId, input }: { courseId: string; input: CourseUpdateInput }) =>
      crmService.updateCourse(courseId, input),
    onSuccess: (_data, variables) => {
      void writeAuditLog('crm.course_updated', 'course', variables.courseId, {})
      qc.invalidateQueries({ queryKey: ['crm', 'courses'] })
      qc.invalidateQueries({ queryKey: crmKeys.all })
    }
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: crmService.createLead,
    onSuccess: () => {
      void writeAuditLog('crm.lead_created', 'crm_lead', undefined, {})
      qc.invalidateQueries({ queryKey: crmKeys.all })
    }
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, input }: { leadId: string; input: Record<string, unknown> }) =>
      crmService.updateLead(leadId, input),
    onSuccess: (_data, variables) => {
      void writeAuditLog('crm.lead_updated', 'crm_lead', variables.leadId, {})
      qc.invalidateQueries({ queryKey: crmKeys.lead(variables.leadId) })
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: ['crm', 'pipeline'] })
      qc.invalidateQueries({ queryKey: crmKeys.kpis })
    }
  })
}

export function useMoveStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, stageId, reason }: { leadId: string; stageId: string; reason?: string }) =>
      crmService.moveStage(leadId, stageId, reason),
    onSuccess: (_data, variables) => {
      void writeAuditLog('crm.stage_changed', 'crm_lead', variables.leadId, {})
      qc.invalidateQueries({ queryKey: crmKeys.all })
    }
  })
}

export function useAssignLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, ownerId }: { leadId: string; ownerId: string }) =>
      crmService.assignLead(leadId, ownerId),
    onSuccess: (_data, variables) => {
      void writeAuditLog('crm.lead_assigned', 'crm_lead', variables.leadId, {})
      qc.invalidateQueries({ queryKey: crmKeys.all })
    }
  })
}

export function useCloseLost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, reasonId, notes }: { leadId: string; reasonId: string; notes?: string }) =>
      crmService.closeLost(leadId, reasonId, notes),
    onSuccess: (_data, variables) => {
      void writeAuditLog('crm.lead_lost', 'crm_lead', variables.leadId, {})
      qc.invalidateQueries({ queryKey: crmKeys.all })
    }
  })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: crmService.createActivity,
    onSuccess: (_data, variables) => {
      void writeAuditLog('crm.activity_created', 'crm_activity', undefined, { lead_id: variables.lead_id })
      qc.invalidateQueries({ queryKey: ['crm', 'agenda'] })
      qc.invalidateQueries({ queryKey: crmKeys.lead(variables.lead_id) })
      qc.invalidateQueries({ queryKey: crmKeys.kpis })
    }
  })
}

export function useCompleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, outcome }: { activityId: string; outcome?: string }) =>
      crmService.completeActivity(activityId, outcome),
    onSuccess: () => {
      void writeAuditLog('crm.activity_completed', 'crm_activity', undefined, {})
      qc.invalidateQueries({ queryKey: ['crm', 'agenda'] })
      qc.invalidateQueries({ queryKey: crmKeys.kpis })
    }
  })
}

export function useRescheduleActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, newDueAt }: { activityId: string; newDueAt: string }) =>
      crmService.rescheduleActivity(activityId, newDueAt),
    onSuccess: () => {
      void writeAuditLog('crm.activity_rescheduled', 'crm_activity', undefined, {})
      qc.invalidateQueries({ queryKey: ['crm', 'agenda'] })
    }
  })
}
