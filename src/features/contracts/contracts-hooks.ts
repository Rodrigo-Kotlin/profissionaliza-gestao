import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contractsService } from './contracts-service'
import type { ContractListParams, ContractExecutionMethod } from './contracts-types'
import { saleKeys } from '../sales/sales-hooks'

export const contractKeys = {
  all: ['contracts'] as const,
  list: (params: ContractListParams) => ['contracts', 'list', params] as const,
  detail: (id: string) => ['contracts', 'detail', id] as const,
  timeline: (id: string) => [...contractKeys.detail(id), 'timeline'] as const,
  documents: (id: string) => [...contractKeys.detail(id), 'documents'] as const,
  executions: (id: string) => [...contractKeys.detail(id), 'executions'] as const
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

export function useContractDocuments(id: string) {
  return useQuery({
    queryKey: contractKeys.documents(id),
    queryFn: () => contractsService.listDocuments(id),
    enabled: Boolean(id)
  })
}

export function useGenerateContractDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.generateDocument,
    onSuccess: (_data, contractId) => {
      qc.invalidateQueries({ queryKey: contractKeys.documents(contractId) })
      qc.invalidateQueries({ queryKey: contractKeys.detail(contractId) })
      qc.invalidateQueries({ queryKey: contractKeys.timeline(contractId) })
    }
  })
}

export function useDownloadContractDocument() {
  return useMutation({ mutationFn: contractsService.downloadDocument })
}

export function useDownloadContractExecution() {
  return useMutation({ mutationFn: contractsService.downloadExecution })
}

export function useContractExecutions(documentId: string | undefined) {
  return useQuery({
    queryKey: contractKeys.executions(documentId ?? ''),
    queryFn: () => contractsService.listExecutions(documentId!),
    enabled: Boolean(documentId)
  })
}

function invalidateExecutionContract(qc: ReturnType<typeof useQueryClient>, contractId: string, documentId: string) {
  qc.invalidateQueries({ queryKey: contractKeys.executions(documentId) })
  qc.invalidateQueries({ queryKey: contractKeys.detail(contractId) })
  qc.invalidateQueries({ queryKey: contractKeys.timeline(contractId) })
  qc.invalidateQueries({ queryKey: contractKeys.all })
}

export function useCreateContractExecution(contractId: string, documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { execution_method: ContractExecutionMethod; signer_person_id: string; signer_name_snapshot: string; signed_at?: string | null }) =>
      contractsService.createExecution({ document_id: documentId, ...input }),
    onSuccess: () => invalidateExecutionContract(qc, contractId, documentId)
  })
}

export function useUploadContractExecution(contractId: string, documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.uploadExecution,
    onSuccess: () => invalidateExecutionContract(qc, contractId, documentId)
  })
}

export function useVerifyContractExecution(contractId: string, documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.verifyExecution,
    onSuccess: () => invalidateExecutionContract(qc, contractId, documentId)
  })
}

export function useRejectContractExecution(contractId: string, documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.rejectExecution,
    onSuccess: () => invalidateExecutionContract(qc, contractId, documentId)
  })
}

export function useCompleteContractExecution(contractId: string, documentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsService.completeExecution,
    onSuccess: () => invalidateExecutionContract(qc, contractId, documentId)
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
      qc.invalidateQueries({ queryKey: ['enrollments'] })
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
