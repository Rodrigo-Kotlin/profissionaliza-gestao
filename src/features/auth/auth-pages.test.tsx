import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './auth-pages'

const authMock = vi.hoisted(() => ({ signInWithPassword: vi.fn() }))
const toastMock = vi.hoisted(() => ({ error: vi.fn() }))
const writeAuditLogMock = vi.hoisted(() => vi.fn())
const useAuthMock = vi.hoisted(() => vi.fn(() => ({ session: null })))

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: authMock }
}))
vi.mock('@/services/audit-service', () => ({ writeAuditLog: writeAuditLogMock }))
vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('./auth-context', () => ({ useAuth: () => useAuthMock() }))

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.signInWithPassword.mockResolvedValue({ error: null })
  })

  it('oferece alvo de 44px, alterna a senha e atualiza o accessible name', async () => {
    const user = userEvent.setup()
    renderLogin()
    const password = screen.getByLabelText('Senha', { exact: true })
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' })

    expect(toggle).toHaveClass('size-11')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(password).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument()
  })

  it('não exibe o controle Lembrar acesso nem envia remember', async () => {
    const user = userEvent.setup()
    renderLogin()
    expect(screen.queryByText('Lembrar acesso')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('E-mail corporativo'), 'ana@instituicao.com.br')
    await user.type(screen.getByLabelText('Senha', { exact: true }), 'senha-valida')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(authMock.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@instituicao.com.br', password: 'senha-valida' })
    expect(authMock.signInWithPassword.mock.calls[0]?.[0]).not.toHaveProperty('remember')
  })

  it('continua submetendo login válido e registrando autenticação', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('E-mail corporativo'), 'ana@instituicao.com.br')
    await user.type(screen.getByLabelText('Senha', { exact: true }), 'senha-valida')
    await user.keyboard('{Enter}')

    expect(authMock.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(writeAuditLogMock).toHaveBeenCalledWith('auth.login', 'session')
  })

  it('mantém o feedback atual para credenciais inválidas', async () => {
    const user = userEvent.setup()
    authMock.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    renderLogin()
    await user.type(screen.getByLabelText('E-mail corporativo'), 'invalido@instituicao.com.br')
    await user.type(screen.getByLabelText('Senha', { exact: true }), 'senha-invalida')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(toastMock.error).toHaveBeenCalledWith('E-mail ou senha inválidos.')
    expect(writeAuditLogMock).not.toHaveBeenCalled()
  })
})
