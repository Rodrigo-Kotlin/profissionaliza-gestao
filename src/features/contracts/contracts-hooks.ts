import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contractsService } from './contracts-service'
import type { ContractListParams } from './contracts-types'
import { saleKeys } from '../sales/sales-hooks'

export const contractKeys = {
  all: ['contracts'] as const,
  list: (params: ContractListParams) => ['contracts', 'list', params] as const,
  detail: (id: string) => ['contracts', 'detail', id] as const,
  timeline: (id: string) => [...contractKeys.detail(id), 'timeline'] as const
}

export function useContractList(params: ContractListParams) {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: () => contractsService.list(params)
  })
}

export function useContractDetail(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: () => contractsService.detail(id),
    enabled: Boolean(id)
  })
}

export function useContractTimeline(id: string) {
  return useQuery({
    queryKey: contractKeys.timeline(id),
    queryFn: () => contractsService.timeline(id),
    enabled: Boolean(id)
  })
}

export function useCreateContractFromSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.createFromSale,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: contractKeys.all })
      qc.invalidateQueries({ queryKey: saleKeys.detail(variables.sale_id) })
    }
  })
}

export function useUpdateContractDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.updateDraft,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: contractKeys.all })
      qc.invalidateQueries({ queryKey: contractKeys.detail(variables.contract_id) })
      qc.invalidateQueries({ queryKey: contractKeys.timeline(variables.contract_id) })
    }
  })
}

export function useIssueContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.issue,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: contractKeys.all })
      qc.invalidateQueries({ queryKey: contractKeys.detail(data.contract_id) })
      qc.invalidateQueries({ queryKey: contractKeys.timeline(data.contract_id) })
      qc.invalidateQueries({ queryKey: saleKeys.all })
    }
  })
}

export function useSignContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.sign,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: contractKeys.all })
      qc.invalidateQueries({ queryKey: contractKeys.detail(data.contract_id) })
      qc.invalidateQueries({ queryKey: contractKeys.timeline(data.contract_id) })
      qc.invalidateQueries({ queryKey: saleKeys.all })
    }
  })
}

export function useCancelContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.cancel,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: contractKeys.all })
      qc.invalidateQueries({ queryKey: contractKeys.detail(data.contract_id) })
      qc.invalidateQueries({ queryKey: contractKeys.timeline(data.contract_id) })
      qc.invalidateQueries({ queryKey: saleKeys.all })
    }
  })
}

export function useSearchContractorPeople(query: string) {
  return useQuery({
    queryKey: ['contracts', 'people-search', query] as const,
    queryFn: () => contractsService.searchContractorPeople({ query }),
    enabled: query.trim().length >= 2
  })
}

export function useContractorDetail(personId: string | null | undefined) {
  return useQuery({
    queryKey: ['contracts', 'contractor-detail', personId] as const,
    queryFn: () => contractsService.getContractorDetail(personId!),
    enabled: Boolean(personId)
  })
}

export function useUpdatePerson() {
  return useMutation({
    mutationFn: contractsService.updatePerson
  })
}

export function useCreatePerson() {
  return useMutation({
    mutationFn: contractsService.createPerson
  })
}