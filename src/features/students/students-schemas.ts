import { z } from 'zod'
import { GUARDIAN_RELATIONSHIPS, STUDENT_ORIGINS, STUDENT_STATUSES } from '@/lib/rbac'
import { isValidCpf, normalizePhone } from './students-utils'

const optionalText = (max: number, message?: string) =>
  z.string().trim().max(max, message).optional()

export const generateStudentFormSchema = (cpfRequired = false) =>
  z.object({
    full_name: z.string().trim().min(3, 'Informe o nome completo.').max(240, 'Nome muito longo.'),
    preferred_name: optionalText(120, 'Nome social/preferido muito longo.'),
    cpf: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || isValidCpf(v), { message: 'CPF inválido.' })
      .refine((v) => !cpfRequired || (v && isValidCpf(v)), { message: 'Informe o CPF.' }),
    rg: optionalText(20, 'RG muito longo.'),
    birth_date: z.string().optional(),
    email: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'E-mail inválido.' }),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || normalizePhone(v).length >= 10, { message: 'Telefone incompleto.' }),
    whatsapp: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || normalizePhone(v).length >= 10, { message: 'WhatsApp incompleto.' }),
    postal_code: optionalText(12),
    street: optionalText(180),
    number: optionalText(20),
    complement: optionalText(120),
    district: optionalText(120),
    city: optionalText(120),
    state: optionalText(2, 'Estado inválido.')
      .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), { message: 'Estado inválido.' }),
    emergency_contact_name: optionalText(240),
    emergency_contact_phone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || normalizePhone(v).length >= 10, { message: 'Telefone incompleto.' }),
    origin: z
      .string()
      .optional()
      .refine((v) => !v || (STUDENT_ORIGINS as readonly string[]).includes(v), { message: 'Origem inválida.' }),
    notes: optionalText(2000)
  })

export type StudentFormValues = z.input<ReturnType<typeof generateStudentFormSchema>>

export const generateStudentUpdateSchema = () => {
  const { cpf: _cpf, rg: _rg, ...rest } = generateStudentFormSchema().shape
  void _cpf
  void _rg
  return z.object(rest)
}

export type StudentUpdateValues = z.input<ReturnType<typeof generateStudentUpdateSchema>>

export const guardianSchema = z.object({
  full_name: z.string().trim().min(3, 'Informe o nome do responsável.').max(240),
  cpf: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidCpf(v), { message: 'CPF inválido.' }),
  relationship: z.enum(GUARDIAN_RELATIONSHIPS, { message: 'Selecione o parentesco.' }),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || normalizePhone(v).length >= 10, { message: 'Telefone incompleto.' }),
  whatsapp: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || normalizePhone(v).length >= 10, { message: 'WhatsApp incompleto.' }),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'E-mail inválido.' }),
  is_primary_contact: z.boolean().optional(),
  is_financial_responsible: z.boolean().optional(),
  is_legal_guardian: z.boolean().optional(),
  notes: optionalText(2000)
})

export type GuardianFormValues = z.input<typeof guardianSchema>

export const changeStatusSchema = z
  .object({
    new_status: z.string().refine((v) => (STUDENT_STATUSES as readonly string[]).includes(v), {
      message: 'Selecione o novo status.'
    }),
    reason: optionalText(2000)
  })
  .superRefine((data, ctx) => {
    if (data.new_status === 'INATIVO' || data.new_status === 'CANCELADO' || data.new_status === 'CONCLUIDO') {
      if (!data.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Informe o motivo da alteração.' })
    }
  })

export type ChangeStatusValues = z.input<typeof changeStatusSchema>