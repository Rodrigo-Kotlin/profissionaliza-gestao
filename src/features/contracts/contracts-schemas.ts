import { z } from 'zod'
import { isValidCpf, normalizePhone } from '../students/students-utils'

const optionalText = (max: number, message?: string) =>
  z.string().trim().max(max, message).optional()

export const contractNotesField = z.string().trim().max(2000, 'Notas muito longas.').optional()

export const createContractSchema = z.object({
  contractor_person_id: z.string().min(1, 'Selecione o contratante.'),
  contract_notes: contractNotesField
})

export type CreateContractInput = z.infer<typeof createContractSchema>

export const editDraftSchema = z.object({
  contractor_person_id: z.string().min(1, 'Selecione o contratante.'),
  contract_notes: contractNotesField
})

export type EditDraftInput = z.infer<typeof editDraftSchema>

export const cancelContractSchema = z.object({
  cancellation_reason: z.string().trim().min(1, 'Motivo do cancelamento obrigatório').max(2000, 'Motivo muito longo.')
})

export type CancelContractInput = z.infer<typeof cancelContractSchema>

export const personFormSchema = z.object({
  full_name: z.string().trim().min(3, 'Informe o nome completo.').max(240, 'Nome muito longo.'),
  preferred_name: optionalText(120),
  cpf: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || isValidCpf(v), { message: 'CPF inválido.' }),
  rg: optionalText(20),
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
  state: optionalText(2).refine((v) => !v || /^[A-Za-z]{2}$/.test(v), { message: 'Estado inválido.' }),
  emergency_contact_name: optionalText(240),
  emergency_contact_phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || normalizePhone(v).length >= 10, { message: 'Telefone incompleto.' }),
  notes: optionalText(2000)
})