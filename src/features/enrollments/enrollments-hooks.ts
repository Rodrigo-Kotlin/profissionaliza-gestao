import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enrollmentsService } from './enrollments-service'
import type { EnrollmentListParams } from './enrollment-types'
import { studentKeys } from '../students/students-hooks'
import { saleKeys } from '../sales/sales-hooks'
import { contractKeys } from '../contracts/contracts-hooks'

export const enrollmentKeys = {
  all: ['enrollments'] as const,
  list: (params: EnrollmentListParams) => ['enrollments', 'list', params] as const,
  detail: (id: string) => ['enrollments', 'detail', id] as const
}

export function useEnrollmentList(params: EnrollmentListParams) {
  return useQuery({ queryKey: enrollmentKeys.list(params), queryFn: () => enrollmentsService.list(params) })
}

export function useEnrollmentDetail(id: string) {
  return useQuery({ queryKey: enrollmentKeys.detail(id), queryFn: () => enrollmentsService.detail(id), enabled: Boolean(id) })
}

function useEnrollmentMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.all })
      queryClient.invalidateQueries({ queryKey: studentKeys.all })
      queryClient.invalidateQueries({ queryKey: saleKeys.all })
      queryClient.invalidateQueries({ queryKey: contractKeys.all })
      if (typeof variables === 'string') queryClient.invalidateQueries({ queryKey: enrollmentKeys.detail(variables) })
      else if (variables && typeof variables === 'object' && 'id' in variables) queryClient.invalidateQueries({ queryKey: enrollmentKeys.detail(variables.id as string) })
    }
  })
}

export function useActivateEnrollment() { return useEnrollmentMutation((id: string) => enrollmentsService.activate(id)) }
export function usePauseEnrollment() { return useEnrollmentMutation(({ id, reason }: { id: string; reason: string }) => enrollmentsService.pause(id, reason)) }
export function useResumeEnrollment() { return useEnrollmentMutation((id: string) => enrollmentsService.resume(id)) }
export function useCompleteEnrollment() { return useEnrollmentMutation((id: string) => enrollmentsService.complete(id)) }
export function useCancelEnrollment() { return useEnrollmentMutation(({ id, reason }: { id: string; reason: string }) => enrollmentsService.cancel(id, reason)) }
