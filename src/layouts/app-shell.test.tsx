import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from './app-shell'

const useAuthMock = vi.hoisted(() =>
  vi.fn(() => ({
    profile: { full_name: 'Usuário Teste' },
    user: { email: 'teste@exemplo.com' },
    permissions: [
      'dashboard.view',
      'crm.view',
      'sales.view',
      'contracts.view',
      'students.view',
      'courses.view',
      'users.view'
    ],
    signOut: vi.fn()
  }))
)

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('@/features/search/command-palette', () => ({
  CommandPalette: () => null
}))

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AppShell />
    </MemoryRouter>
  )
}

describe('AppShell — navegação sem ações não funcionais', () => {
  it('não renderiza o botão "Criar" no topbar', () => {
    renderShell()
    expect(screen.queryByRole('button', { name: /criar/i })).toBeNull()
    expect(screen.queryByText('Criar')).toBeNull()
  })

  it('não renderiza "Novo Registro" no menu lateral', () => {
    renderShell()
    expect(screen.queryByRole('button', { name: /novo registro/i })).toBeNull()
    expect(screen.queryByText('Novo Registro')).toBeNull()
  })

  it('mantém a navegação funcional e o menu principal renderizados', () => {
    renderShell()
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeInTheDocument()
    expect(screen.getByText('Visão Geral')).toBeInTheDocument()
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByText('Vendas')).toBeInTheDocument()
    expect(screen.getByText('Contratos')).toBeInTheDocument()
    expect(screen.getByText('Alunos')).toBeInTheDocument()
    expect(screen.getByText('Usuários')).toBeInTheDocument()
  })
})