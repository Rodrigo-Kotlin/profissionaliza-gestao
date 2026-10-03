import { assertOnline } from '@/lib/offline'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type { EnrollmentDetail, EnrollmentListParams, EnrollmentListResponse } from './enrollment-types'

type Functions = Database['public']['Functions']
type RpcArgs<K extends keyof Functions> = Functions[K] extends { Args: infer A } ? A : Record<string, never>
type RpcReturns<K extends keyof Functions> = Functions[K] extends { Returns: infer R } ? R : unknown

async function rpc<K extends keyof Functions>(fn: K, args?: RpcArgs<K>): Promise<{ data: RpcReturns<K> | null; error: unknown }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (supabase.rpc as any)(fn, args ?? {})
  return result as { data: RpcReturns<K> | null; error: unknown }
}

function optional(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}

export const enrollmentsService = {
  async list(params: EnrollmentListParams): Promise<EnrollmentListResponse> {
    const { data, error } = await rpc('list_enrollments', {
      p_q: optional(params.q),
      p_status: optional(params.status),
      p_course_id: optional(params.course_id),
      p_student_id: optional(params.student_id),
      p_date_from: optional(params.date_from),
      p_date_to: optional(params.date_to),
      p_page: params.page ?? 1,
      p_page_size: params.page_size ?? 20
    })
    if (error) throw error
    return data as EnrollmentListResponse
  },

  async detail(id: string): Promise<EnrollmentDetail> {
    const { data, error } = await rpc('get_enrollment_detail', { p_enrollment_id: id })
    if (error) throw error
    return data as EnrollmentDetail
  },

  async activate(id: string): Promise<unknown> {
    assertOnline()
    const { data, error } = await rpc('activate_enrollment', { p_enrollment_id: id })
    if (error) throw error
    return data
  },

  async pause(id: string, reason: string): Promise<unknown> {
    assertOnline()
    const { data, error } = await rpc('pause_enrollment', { p_enrollment_id: id, p_reason: reason })
    if (error) throw error
    return data
  },

  async resume(id: string): Promise<unknown> {
    assertOnline()
    const { data, error } = await rpc('resume_enrollment', { p_enrollment_id: id })
    if (error) throw error
    return data
  },

  async complete(id: string): Promise<unknown> {
    assertOnline()
    const { data, error } = await rpc('complete_enrollment', { p_enrollment_id: id })
    if (error) throw error
    return data
  },

  async cancel(id: string, reason: string): Promise<unknown> {
    assertOnline()
    const { data, error } = await rpc('cancel_enrollment', { p_enrollment_id: id, p_reason: reason })
    if (error) throw error
    return data
  }
}
