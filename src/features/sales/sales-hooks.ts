import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesService } from './sales-service'
import type { SaleListParams } from './sales-types'
import { crmKeys } from '../crm/crm-hooks'

export const saleKeys = {
  all: ['sales'] as const,
  list: (params: SaleListParams) => ['sales', 'list', params] as const,
  detail: (id: string) => ['sales', 'detail', id] as const
}

export function useSaleList(params: SaleListParams) {
  return useQuery({
    queryKey: saleKeys.list(params),
    queryFn: () => salesService.listSales(params)
  })
}

export function useSaleDetail(id: string) {
  return useQuery({
    queryKey: saleKeys.detail(id),
    queryFn: () => salesService.getSaleDetail(id),
    enabled: Boolean(id)
  })
}

export function useCreateSaleFromLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: salesService.createFromLead,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: saleKeys.all })
      qc.invalidateQueries({ queryKey: crmKeys.lead(variables.lead_id) })
      qc.invalidateQueries({ queryKey: crmKeys.leadTimeline(variables.lead_id) })
      qc.invalidateQueries({ queryKey: crmKeys.leadActivities(variables.lead_id) })
      qc.invalidateQueries({ queryKey: crmKeys.pipeline() })
      qc.invalidateQueries({ queryKey: crmKeys.kpis })
      qc.invalidateQueries({ queryKey: ['crm', 'leads'] })
      qc.invalidateQueries({ queryKey: ['crm', 'agenda'] })
    }
  })
}

export function useCancelSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason: string }) =>
      salesService.cancelSale(saleId, reason),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: saleKeys.all })
      qc.invalidateQueries({ queryKey: saleKeys.detail(variables.saleId) })
    }
  })
}
