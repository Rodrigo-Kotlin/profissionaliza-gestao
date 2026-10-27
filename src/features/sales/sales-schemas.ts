import { z } from 'zod'

export const closeSaleSchema = z.object({
  offer_id: z.string().min(1, 'Oferta obrigatória'),
  price_plan_id: z.string().min(1, 'Plano de preço obrigatório'),
  discount_value: z.coerce.number().min(0, 'Desconto não pode ser negativo').default(0),
  commercial_notes: z.string().max(2000).optional()
})

export type CloseSaleInput = z.infer<typeof closeSaleSchema>

export const cancelSaleSchema = z.object({
  cancellation_reason: z.string().trim().min(1, 'Motivo do cancelamento obrigatório').max(2000)
})

export type CancelSaleInput = z.infer<typeof cancelSaleSchema>

export const saleListFilterSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  seller_user_id: z.string().optional(),
  course_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional()
})

export type SaleListFilterInput = z.infer<typeof saleListFilterSchema>
