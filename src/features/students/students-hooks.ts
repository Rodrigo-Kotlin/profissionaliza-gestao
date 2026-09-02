import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { studentsService } from './students-service'
import { writeAuditLog } from '@/services/audit-service'
import type { GuardianInput } from './students-types'
import type { StudentListParams } from './students-types'

export const studentKeys = {
  all: ['students'] as const,
  list: (params: StudentListParams) => ['students', 'list', params] as const,
  detail: (id: string) => ['students', 'detail', id] as const,
  guardians: (id: string) => ['students', 'guardians', id] as const,
  history: (id: string) => ['students', 'history', id] as const,
  kpis: ['students', 'kpis'] as const
}

export function useStudents(params: StudentListParams) {
  return useQuery({
    queryKey: studentKeys.list(params),
    queryFn: () => studentsService.list(params)
  })
}

export function useStudentDetail(id: string) {
  return useQuery({
    queryKey: studentKeys.detail(id),
    queryFn: () => studentsService.detail(id),
    enabled: Boolean(id)
  })
}

export function useStudentGuardians(id: string) {
  return useQuery({
    queryKey: studentKeys.guardians(id),
    queryFn: () => studentsService.listGuardians(id),
    enabled: Boolean(id)
  })
}

export function useStudentHistory(id: string) {
  return useQuery({
    queryKey: studentKeys.history(id),
    queryFn: () => studentsService.history(id),
    enabled: Boolean(id)
  })
}

export function useStudentKpis() {
  return useQuery({
    queryKey: studentKeys.kpis,
    queryFn: () => studentsService.kpis()
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof studentsService.create>[0]) => studentsService.create(input),
    onSuccess: async (id) => {
      await writeAuditLog('student.created', 'student', id)
      queryClient.invalidateQueries({ queryKey: studentKeys.list({}) })
      queryClient.invalidateQueries({ queryKey: studentKeys.kpis })
    }
  })
}

export function useUpdateStudent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof studentsService.update>[1] }) =>
      studentsService.update(id, input),
    onSuccess: async (_data, vars) => {
      await writeAuditLog('student.updated', 'student', vars.id)
      toast.success('Dados do aluno atualizados.')
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(vars.id) })
      queryClient.invalidateQueries({ queryKey: studentKeys.list({}) })
    }
  })
}

export function useChangeStudentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      studentsService.changeStatus(id, status, reason),
    onSuccess: async (_data, vars) => {
      await writeAuditLog('student.status_changed', 'student', vars.id)
      toast.success('Status do aluno atualizado.')
      queryClient.invalidateQueries({ queryKey: studentKeys.all })
    }
  })
}

export function useLinkGuardian(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GuardianInput) => studentsService.linkGuardian(studentId, input),
    onSuccess: async (id) => {
      await writeAuditLog('guardian.linked', 'student_guardian', id)
      toast.success('Responsável vinculado.')
      queryClient.invalidateQueries({ queryKey: studentKeys.guardians(studentId) })
    }
  })
}

export function useUnlinkGuardian(studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (guardianId: string) => studentsService.unlinkGuardian(guardianId),
    onSuccess: async (_, guardianId) => {
      await writeAuditLog('guardian.unlinked', 'student_guardian', guardianId)
      toast.success('Vínculo removido.')
      queryClient.invalidateQueries({ queryKey: studentKeys.guardians(studentId) })
    }
  })
}