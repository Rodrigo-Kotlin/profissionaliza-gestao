import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { UsersPage } from './users-pages'
import type { Profile } from '@/types/database'

const useAuthMock = vi.hoisted(() => vi.fn(() => ({
  permissions: ['users.view'],
  profile: null,
  user: null,
  signOut: vi.fn()
})))

const supabaseFromMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: supabaseFromMock }
}))

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    full_name: 'Ana Beatriz Oliveira',
    email: 'ana.beatriz.oliveira@empresa.com.br',
    phone: null,
    avatar_url: null,
    is_active: true,
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
    ...overrides
  }
}

function renderUsersPage(profiles: Profile[], permissions: string[] = ['users.view']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthMock.mockImplementation(() => ({
    permissions,
    profile: null,
    user: null,
    signOut: vi.fn()
  }))
  supabaseFromMock.mockReturnValue({
    select: vi.fn(() => ({ order: vi.fn(() => ({ data: profiles, error: null })) }))
  })
  return render(
    <QueryClientProvider client={client}>
      <UsersPage />
    </QueryClientProvider>
  )
}

describe('UsersPage — usuários mobile (Fase 4)', () => {
  beforeEach(() => {
    useAuthMock.mockClear()
    supabaseFromMock.mockClear()
  })

  it('busca apenas a tabela de perfis (sem query extra por papel)', async () => {
    renderUsersPage([makeProfile()])
    expect(await screen.findByRole('list')).toBeTruthy()
    expect(supabaseFromMock).toHaveBeenCalledWith('profiles')
  })

  it('mobileCard renderiza nome, e-mail e status', async () => {
    renderUsersPage([makeProfile()])

    const card = within(await screen.findByRole('list'))
    expect(card.getByText('Ana Beatriz Oliveira')).toBeTruthy()
    expect(card.getByText('ana.beatriz.oliveira@empresa.com.br')).toBeTruthy()
    expect(card.getByText('Ativo')).toBeTruthy()
  })

  it('nome e e-mail usam truncate controlado com min-w-0 (sem overflow)', async () => {
    renderUsersPage([makeProfile()])

    const card = within(await screen.findByRole('list'))
    const name = card.getByText('Ana Beatriz Oliveira')
    const email = card.getByText('ana.beatriz.oliveira@empresa.com.br')
    expect(name.className).toContain('truncate')
    expect(email.className).toContain('truncate')
    expect(name.closest('div')!.className).toContain('min-w-0')
  })

  it('tabela desktop permanece renderizada com as colunas atuais', async () => {
    renderUsersPage([makeProfile({ is_active: false })])

    const table = within(await screen.findByRole('table'))
    expect(table.getByText('Usuário')).toBeTruthy()
    expect(table.getByText('Status')).toBeTruthy()
    expect(table.getByText('Criado em')).toBeTruthy()
    expect(table.getByText('Inativo')).toBeTruthy()
  })

  it('sem permissão, mostra acesso restrito', async () => {
    renderUsersPage([], [])
    expect(await screen.findByText('Acesso restrito')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('botão Gerenciar papéis respeita a permissão de gerenciamento', async () => {
    const { rerender } = renderUsersPage([makeProfile()])
    await screen.findByRole('list')

    expect(screen.getByRole('button', { name: 'Gerenciar papéis' })).toBeDisabled()

    useAuthMock.mockImplementation(() => ({
      permissions: ['users.view', 'users.manage'],
      profile: null,
      user: null,
      signOut: vi.fn()
    }))
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <UsersPage />
      </QueryClientProvider>
    )
    expect(await screen.findByRole('button', { name: 'Gerenciar papéis' })).toBeEnabled()
  })
})