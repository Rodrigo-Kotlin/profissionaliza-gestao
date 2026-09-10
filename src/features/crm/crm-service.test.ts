import { describe, it, expect, vi, beforeEach } from 'vitest'
import { crmService } from './crm-service'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: rpcMock
  }
}))

describe('crmService.listCourses', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('envia p_status undefined quando status é null (catálogo: todos)', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await crmService.listCourses(null)
    expect(rpcMock).toHaveBeenCalledWith('list_courses', { p_status: undefined })
  })

  it('não envia p_status quando o argumento é omitido (todos)', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await crmService.listCourses()
    expect(rpcMock).toHaveBeenCalledWith('list_courses', { p_status: undefined })
  })

  it('envia p_status ACTIVE quando o filtro é ACTIVE (formulário de Lead)', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    await crmService.listCourses('ACTIVE')
    expect(rpcMock).toHaveBeenCalledWith('list_courses', { p_status: 'ACTIVE' })
  })
})

describe('crmService.createCourse', () => {
  it('envia os parâmetros reais da RPC create_course e retorna course_id', async () => {
    rpcMock.mockResolvedValue({ data: 'course-uuid', error: null })
    const id = await crmService.createCourse({
      code: 'ADM-TESTE',
      name: 'Auxiliar Administrativo — Teste',
      modality: 'PRESENCIAL',
      workload_hours: 40,
      default_price: 500
    })
    expect(rpcMock).toHaveBeenCalledWith('create_course', {
      p_code: 'ADM-TESTE',
      p_name: 'Auxiliar Administrativo — Teste',
      p_short_name: undefined,
      p_category: undefined,
      p_modality: 'PRESENCIAL',
      p_workload_hours: 40,
      p_duration_value: undefined,
      p_duration_unit: undefined,
      p_default_price: 500,
      p_description: undefined
    })
    expect(id).toBe('course-uuid')
  })
})

describe('crmService.updateCourse', () => {
  it('envia os parâmetros reais da RPC update_course, incluindo status', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    await crmService.updateCourse('course-uuid', { name: 'Novo nome', status: 'ACTIVE' })
    expect(rpcMock).toHaveBeenCalledWith('update_course', {
      p_course_id: 'course-uuid',
      p_name: 'Novo nome',
      p_short_name: undefined,
      p_category: undefined,
      p_modality: undefined,
      p_workload_hours: undefined,
      p_duration_value: undefined,
      p_duration_unit: undefined,
      p_default_price: undefined,
      p_description: undefined,
      p_status: 'ACTIVE'
    })
  })
})

describe('crmService.getLeadDetail', () => {
  it('chama a RPC get_crm_lead_detail com p_lead_id', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'lead-uuid' }, error: null })
    await crmService.getLeadDetail('lead-uuid')
    expect(rpcMock).toHaveBeenCalledWith('get_crm_lead_detail', { p_lead_id: 'lead-uuid' })
  })
})
