import { z } from 'zod'

export const leadFormSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório').max(240),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  source_code: z.string().min(1, 'Origem é obrigatória'),
  course_interest_id: z.string().uuid().optional().or(z.literal('')),
  owner_user_id: z.string().uuid().optional().or(z.literal('')),
  stage_id: z.string().uuid().optional().or(z.literal('')),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  entry_type: z.enum(['PROSPECTING', 'LEAD_RECEIVED']).optional(),
  commercial_notes: z.string().max(2000).optional(),
  first_activity_title: z.string().max(200).optional(),
  first_activity_type: z.enum(['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'OTHER']).optional(),
  first_activity_due_at: z.string().optional()
})

export type LeadFormInput = z.infer<typeof leadFormSchema>

export const leadUpdateSchema = z.object({
  source_id: z.string().uuid().optional().or(z.literal('')),
  course_interest_id: z.string().uuid().optional().or(z.literal('')),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  stage_id: z.string().uuid().optional().or(z.literal('')),
  qualification_start_period: z.string().max(100).optional(),
  preferred_shift: z.string().optional(),
  preferred_modality: z.string().optional(),
  budget_notes: z.string().max(1000).optional(),
  decision_maker: z.string().max(200).optional(),
  source_detail: z.string().max(200).optional(),
  estimated_value: z.number().min(0).optional(),
  proposed_value: z.number().min(0).optional(),
  commercial_notes: z.string().max(2000).optional()
})

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>

export const activityFormSchema = z.object({
  type: z.enum(['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'OTHER']),
  title: z.string().min(1, 'Título é obrigatório').max(200),
  description: z.string().max(2000).optional(),
  due_at: z.string().min(1, 'Data é obrigatória'),
  owner_user_id: z.string().uuid().optional().or(z.literal(''))
})

export type ActivityFormInput = z.infer<typeof activityFormSchema>

export const courseFormSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(20).transform((v) => v.toUpperCase().trim()),
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  short_name: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  modality: z.enum(['PRESENCIAL', 'ONLINE', 'HIBRIDO']),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  workload_hours: z.number().int().positive().optional(),
  duration_value: z.number().int().positive().optional(),
  duration_unit: z.string().max(20).optional(),
  default_price: z.number().min(0).optional(),
  description: z.string().max(2000).optional()
})

export type CourseFormInput = z.infer<typeof courseFormSchema>

export const lostLeadSchema = z.object({
  lost_reason_id: z.string().uuid('Selecione um motivo'),
  lost_notes: z.string().max(2000).optional()
}).refine(
  (data) => {
    if (data.lost_notes === undefined) return true
    return true
  },
  { message: 'Justificativa é obrigatória para motivo "Outro"' }
)

export type LostLeadInput = z.infer<typeof lostLeadSchema>
