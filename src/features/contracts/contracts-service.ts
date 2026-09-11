import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'
import type {
  ContractListParams,
  ContractListResponse,
  ContractDetail,
  ContractTimelineResponse,
  ContractorDetail,
  ContractorSearchResponse,
  CreateContractResult,
  CreatePersonResult,
  PersonFormPayload,
  UpdatePersonPayload
} from './contracts-types'
import type { CancelContractInput, EditDraftInput } from './contracts-schemas'
import {
  normalizeCep,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  normalizeState
} from '../students/students-utils'

type Functions = Database['public']['Functions']

type RpcArgs<K extends keyof Functions> = Functions[K] extends { Args: infer A } ? A : Record<string, never>
type RpcReturns<K extends keyof Functions> = Functions[K] extends { Returns: infer R } ? R : unknown

/**
 * Generic typed RPC wrapper. Contains one localized `as any` cast because
 * Supabase's generated Rpc function signature does not expose a fully typed
 * overload for every function name. All calls are otherwise type-safe through
 * the RpcArgs/RpcReturns helpers derived from database.types.ts.
 */
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

const FH = (v?: string | null) => (v === '' || v === null ? undefined : v)
const normalize = {
  cpf: (v?: string) => (v ? normalizeCpf(v) : undefined),
  email: (v?: string) => (v ? normalizeEmail(v) : undefined),
  phone: (v?: string) => (v ? normalizePhone(v) : undefined),
  cep: (v?: string) => (v ? normalizeCep(v) : undefined),
  state: (v?: string) => (v ? normalizeState(v) : undefined)
}

export const contractsService = {
  async createFromSale(input: {
    sale_id: string
    contractor_person_id: string
    contract_notes?: string
  }): Promise<CreateContractResult> {
    const { data, error } = await rpc('create_contract_from_sale', {
      p_sale_id: input.sale_id,
      p_contractor_person_id: input.contractor_person_id,
      p_contract_notes: emptyToUndefined(input.contract_notes)
    })
    if (error) throw error
    return data as CreateContractResult
  },

  async updateDraft(input: EditDraftInput & { contract_id: string }): Promise<CreateContractResult> {
    const { data, error } = await rpc('update_contract_draft', {
      p_contract_id: input.contract_id,
      p_contractor_person_id: input.contractor_person_id,
      p_contract_notes: input.contract_notes ?? ''
    })
    if (error) throw error
    return data as CreateContractResult
  },

  async issue(contractId: string): Promise<CreateContractResult> {
    const { data, error } = await rpc('issue_contract', { p_contract_id: contractId })
    if (error) throw error
    return data as CreateContractResult
  },

  async sign(contractId: string): Promise<CreateContractResult> {
    const { data, error } = await rpc('mark_contract_signed', { p_contract_id: contractId })
    if (error) throw error
    return data as CreateContractResult
  },

  async cancel(input: CancelContractInput & { contract_id: string }): Promise<CreateContractResult> {
    const { data, error } = await rpc('cancel_contract', {
      p_contract_id: input.contract_id,
      p_reason: input.cancellation_reason
    })
    if (error) throw error
    return data as CreateContractResult
  },

  async list(params: ContractListParams): Promise<ContractListResponse> {
    const { data, error } = await rpc('list_contracts', {
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
    return data as ContractListResponse
  },

  async detail(contractId: string): Promise<ContractDetail> {
    const { data, error } = await rpc('get_contract_detail', { p_contract_id: contractId })
    if (error) throw error
    return data as ContractDetail
  },

  async timeline(contractId: string): Promise<ContractTimelineResponse> {
    const { data, error } = await rpc('get_contract_timeline', { p_contract_id: contractId })
    if (error) throw error
    return data as ContractTimelineResponse
  },

  async searchContractorPeople(input: { query?: string; limit?: number }): Promise<ContractorSearchResponse> {
    const { data, error } = await rpc('search_contractor_people', {
      p_query: emptyToUndefined(input.query),
      p_limit: input.limit ?? 8
    })
    if (error) throw error
    return data as ContractorSearchResponse
  },

  async createPerson(input: PersonFormPayload): Promise<CreatePersonResult> {
    const { data, error } = await rpc('create_person', {
      p_full_name: input.full_name,
      p_preferred_name: FH(input.preferred_name),
      p_cpf: normalize.cpf(input.cpf),
      p_rg: FH(input.rg),
      p_birth_date: FH(input.birth_date),
      p_email: normalize.email(input.email),
      p_phone: normalize.phone(input.phone),
      p_whatsapp: normalize.phone(input.whatsapp),
      p_postal_code: normalize.cep(input.postal_code),
      p_street: FH(input.street),
      p_number: FH(input.number),
      p_complement: FH(input.complement),
      p_district: FH(input.district),
      p_city: FH(input.city),
      p_state: normalize.state(input.state),
      p_emergency_contact_name: FH(input.emergency_contact_name),
      p_emergency_contact_phone: normalize.phone(input.emergency_contact_phone),
      p_notes: FH(input.notes)
    })
    if (error) throw error
    return data as CreatePersonResult
  },

  async getContractorDetail(personId: string): Promise<ContractorDetail> {
    const { data, error } = await rpc('get_contractor_detail', { p_person_id: personId })
    if (error) throw error
    return data as ContractorDetail
  },

  async updatePerson(input: UpdatePersonPayload): Promise<{ person_id: string; updated: boolean }> {
    const { data, error } = await rpc('update_person', {
      p_person_id: input.person_id,
      p_full_name: input.full_name,
      p_preferred_name: FH(input.preferred_name),
      p_birth_date: FH(input.birth_date),
      p_email: normalize.email(input.email),
      p_phone: normalize.phone(input.phone),
      p_whatsapp: normalize.phone(input.whatsapp),
      p_postal_code: normalize.cep(input.postal_code),
      p_street: FH(input.street),
      p_number: FH(input.number),
      p_complement: FH(input.complement),
      p_district: FH(input.district),
      p_city: FH(input.city),
      p_state: normalize.state(input.state),
      p_emergency_contact_name: FH(input.emergency_contact_name),
      p_emergency_contact_phone: normalize.phone(input.emergency_contact_phone),
      p_notes: FH(input.notes)
    })
    if (error) throw error
    return data as { person_id: string; updated: boolean }
  }
}