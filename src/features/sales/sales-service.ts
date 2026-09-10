import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { SaleListParams, SaleListResponse, SaleDetail } from './sales-types'

type Functions = Database['public']['Functions']

type RpcArgs<K extends keyof Functions> = Functions[K] extends { Args: infer A } ? A : Record<string, never>
type RpcReturns<K extends keyof Functions> = Functions[K] extends { Returns: infer R } ? R : unknown

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

export const salesService = {
  async createFromLead(input: {
    lead_id: string
    course_id: string
    gross_value: number
    discount_value: number
    payment_method: string
    installments: number
    commercial_notes?: string
  }): Promise<{ sale_id: string; sale_code: string }> {
    const { data, error } = await rpc('create_sale_from_lead', {
      p_lead_id: input.lead_id,
      p_course_id: input.course_id,
      p_gross_value: input.gross_value,
      p_discount_value: input.discount_value,
      p_payment_method: input.payment_method,
      p_installments: input.installments,
      p_commercial_notes: emptyToUndefined(input.commercial_notes)
    })
    if (error) throw error
    return data as { sale_id: string; sale_code: string }
  },

  async listSales(params: SaleListParams): Promise<SaleListResponse> {
    const { data, error } = await rpc('list_sales', {
      p_search: emptyToUndefined(params.search),
      p_status: emptyToUndefined(params.status),
      p_seller_user_id: emptyToUndefined(params.seller_user_id),
      p_course_id: emptyToUndefined(params.course_id),
      p_date_from: emptyToUndefined(params.date_from),
      p_date_to: emptyToUndefined(params.date_to),
      p_page: params.page ?? 1,
      p_page_size: params.page_size ?? 25
    })
    if (error) throw error
    return data as SaleListResponse
  },

  async getSaleDetail(saleId: string): Promise<SaleDetail> {
    const { data, error } = await rpc('get_sale_detail', { p_sale_id: saleId })
    if (error) throw error
    return data as SaleDetail
  },

  async cancelSale(saleId: string, cancellationReason: string): Promise<void> {
    const { error } = await rpc('cancel_sale', {
      p_sale_id: saleId,
      p_cancellation_reason: cancellationReason
    })
    if (error) throw error
  }
}
