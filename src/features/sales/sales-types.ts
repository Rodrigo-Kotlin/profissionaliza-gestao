export type SaleStatus = 'CONFIRMED' | 'CANCELED'

export type SalePaymentMethod = 'PIX' | 'DINHEIRO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'BOLETO' | 'TRANSFERENCIA' | 'OUTRO'

export type SaleListItem = {
  id: string
  sale_code: string
  status: SaleStatus
  lead_id: string
  lead_code: string | null
  full_name: string
  course_name: string
  seller_name: string
  sale_date: string
  gross_value: number
  discount_value: number
  net_value: number
  payment_method: SalePaymentMethod
  installments: number
  created_at: string
}

export type SaleDetail = {
  id: string
  sale_code: string
  status: SaleStatus
  lead_id: string
  lead_code: string | null
  person_id: string
  full_name: string
  student_id: string
  student_code: string
  course_id: string
  course_name_snapshot: string
  course_price_snapshot: number | null
  seller_user_id: string
  seller_name: string
  sale_date: string
  gross_value: number
  discount_value: number
  net_value: number
  payment_method: SalePaymentMethod
  installments: number
  commercial_notes: string | null
  canceled_at: string | null
  canceled_by: string | null
  canceled_by_name: string | null
  cancellation_reason: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
  contract_id?: string | null
  contract_code?: string | null
  contract_status?: string | null
}

export type SaleListParams = {
  search?: string
  status?: string
  seller_user_id?: string
  course_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export type SaleListResponse = {
  data: SaleListItem[]
  total: number
  page: number
  page_size: number
}

export type SaleTimelineEvent = {
  id: string
  event_type: string
  occurred_at: string
  title: string
  description: string | null
  actor_user_id: string | null
  actor_name: string | null
  metadata: Record<string, unknown>
}

export type SaleTimelineResponse = {
  data: SaleTimelineEvent[]
  total: number
}
