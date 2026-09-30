import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './app-shell'

const signOutMock = vi.hoisted(() => vi.fn())

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
    signOut: signOutMock
  }))
)

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => useAuthMock()
}))

vi.mock('@/services/audit-service', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/features/search/command-palette', () => ({
  CommandPalette: () => null
}))

const useOnlineStatusMock = vi.hoisted(() => vi.fn(() => true))

vi.mock('@/lib/offline', () => ({
  useOnlineStatus: () => useOnlineStatusMock()
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

  it('header e main usam a mesma fonte de verdade para a altura efetiva', () => {
    renderShell()
    const header = document.querySelector('header')
    const main = document.getElementById('main')
    expect(header).toBeTruthy()
    expect(main).toBeTruthy()
    expect(header!.className).toContain('app-header')
    expect(header!.className).not.toContain('safe-top')
    expect(header!.className).not.toContain('h-16')
    expect(main!.className).toContain('app-content-top')
    expect(main!.className).not.toContain('pt-16')
  })

  it('drawer mobile respeita safe areas com largura simplificada', async () => {
    const user = userEvent.setup()
    renderShell()

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.className).toContain('safe-top')
    expect(dialog.className).toContain('safe-bottom')
    expect(dialog.className).toContain('w-[86vw]')
    expect(dialog.className).toContain('max-w-[320px]')
    expect(dialog.className).not.toContain('w-[min(90vw,86vw)]')
  })
})

describe('AppShell — sidebar colapsada acessível (Fase 11.1)', () => {
  beforeEach(() => {
    signOutMock.mockClear()
    useAuthMock.mockClear()
  })

  function renderShellCollapsed() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<div>Home test</div>} />
            <Route path="/perfil" element={<div>Perfil page test</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
  }

  it('Perfil e Sair têm nome acessível e continuam executando a ação', async () => {
    const user = userEvent.setup()
    renderShellCollapsed()

    await user.click(screen.getByRole('button', { name: 'Recolher menu' }))

    const perfil = screen.getByRole('button', { name: 'Perfil' })
    const sair = screen.getByRole('button', { name: 'Sair' })
    expect(perfil).toBeInTheDocument()
    expect(sair).toBeInTheDocument()

    await user.click(perfil)
    expect(await screen.findByText('Perfil page test')).toBeInTheDocument()

    await user.click(sair)
    expect(signOutMock).toHaveBeenCalled()
  })

  it('tooltip de Perfil permanece funcional na sidebar colapsada (gatilho Radix preservado)', async () => {
    const user = userEvent.setup()
    renderShellCollapsed()

    await user.click(screen.getByRole('button', { name: 'Recolher menu' }))

    const perfil = screen.getByRole('button', { name: 'Perfil' })
    expect(perfil).toHaveAttribute('data-state', 'closed')
  })
})

describe('AppShell — reserva de espaço do banner offline (Fase 11.3)', () => {
  beforeEach(() => {
    useOnlineStatusMock.mockReset()
    useAuthMock.mockClear()
  })

  it('online: main usa offset apenas do header, sem classe do banner', () => {
    useOnlineStatusMock.mockReturnValue(true)
    renderShell()

    const main = document.getElementById('main')
    expect(main!.className).toContain('app-content-top')
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('.min-h-screen')!.className).not.toContain('offline-banner-active')
  })

  it('offline: conteúdo reserva espaço extra do banner que fica abaixo do header', () => {
    useOnlineStatusMock.mockReturnValue(false)
    renderShell()

    const main = document.getElementById('main')
    expect(main!.className).toContain('app-content-top')
    expect(document.querySelector('.min-h-screen')!.className).toContain('offline-banner-active')

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Você está sem conexão.')
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(banner.className).toContain('app-banner-top')
    expect(banner.className).toContain('z-[65]')
  })
})

describe('AppShell — contraste de label na sidebar (Fase 11.4)', () => {
  beforeEach(() => {
    useAuthMock.mockClear()
  })

  it('labels de seção da sidebar usam opacidade compatível com AA (>= 4.5:1)', () => {
    renderShell()
    const nav = within(screen.getByRole('navigation', { name: 'Menu principal' }))

    for (const label of ['Operação', 'Acadêmico', 'Gestão', 'Administração']) {
      const el = nav.getByText(label)
      expect(el.className).toContain('text-white/60')
      expect(el.className).not.toContain('text-white/45')
    }
  })

  it('botão Recolher menu usa opacidade compatível com AA', () => {
    renderShell()

    const expand = screen.getByRole('button', { name: 'Recolher menu' })
    expect(expand.className).toContain('text-white/65')
    expect(expand.className).not.toContain('text-white/55')
  })

  it('itens de navegação mantêm o token de contraste existente', () => {
    renderShell()

    const crm = screen.getByRole('link', { name: /CRM/ }).closest('a')
    expect(crm).not.toBeNull()
    expect(crm!.className).toContain('text-white/65')
  })

  it('navegação e layout continuam funcionais após ajuste de contraste', async () => {
    const user = userEvent.setup()
    renderShell()

    expect(screen.getByText('Operação')).toBeInTheDocument()
    expect(screen.getByText('Visão Geral')).toBeInTheDocument()
    await user.click(screen.getByText('Alunos'))
  })
})