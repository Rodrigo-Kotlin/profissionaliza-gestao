import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractorSearch, type SelectedContractor } from './contractor-search'

vi.mock('./contracts-hooks', () => ({
  useSearchContractorPeople: () => ({ data: { data: [] }, isLoading: false, isError: false })
}))

vi.mock('../students/students-hooks', () => ({
  useStudentGuardians: () => ({ data: [], isLoading: false, isError: false })
}))

vi.mock('./create-person-modal', () => ({
  CreatePersonModal: () => null
}))

vi.mock('./complete-contractor-form', () => ({
  CompleteContractorForm: () => null
}))

const selected: SelectedContractor = { id: 'p1', full_name: 'Maria Lima', preferred_name: null }

function renderContractor() {
  return render(<ContractorSearch canCreate onSelect={vi.fn()} selected={selected} />)
}

describe('ContractorSearch — touch targets (Fase 6.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Trocar mantém 44px e alterna para o modo de busca', async () => {
    const user = userEvent.setup()
    renderContractor()

    const trocar = screen.getByRole('button', { name: /trocar/i })
    expect(trocar.className).toContain('min-h-11')

    await user.click(trocar)
    expect(screen.getByLabelText('Buscar contratante')).toBeInTheDocument()
  })

  it('Limpar busca é alvo 44x44 com aria-label; Cancelar troca mantém 44px e volta', async () => {
    const user = userEvent.setup()
    renderContractor()

    await user.click(screen.getByRole('button', { name: /trocar/i }))
    await user.type(screen.getByLabelText('Buscar contratante'), 'M')

    const limpar = screen.getByRole('button', { name: 'Limpar busca' })
    expect(limpar.className).toContain('size-11')

    await user.click(limpar)
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).toBeNull()

    const cancelar = screen.getByRole('button', { name: /cancelar troca/i })
    expect(cancelar.className).toContain('min-h-11')

    await user.click(cancelar)
    expect(screen.getByRole('button', { name: /trocar/i })).toBeInTheDocument()
  })
})