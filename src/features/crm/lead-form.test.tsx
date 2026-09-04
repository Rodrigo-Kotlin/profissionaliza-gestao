import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { LeadForm } from './lead-form'

const useCrmCoursesMock = vi.hoisted(() => vi.fn())

vi.mock('./crm-hooks', () => ({
  useCrmCourses: (status?: string) => {
    useCrmCoursesMock(status)
    return { data: [{ id: 'active-1', name: 'Curso Ativo', modality: 'PRESENCIAL' }], isLoading: false, isError: false }
  },
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

describe('LeadForm', () => {
  beforeEach(() => {
    useCrmCoursesMock.mockClear()
  })

  it('seleciona somente cursos ACTIVE no campo de interesse (courses ativos)', () => {
    render(<LeadForm onCreated={() => {}} onCancel={() => {}} />)
    expect(useCrmCoursesMock).toHaveBeenCalledWith('ACTIVE')
  })
})
