import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PermissionRoute } from './permission-route'
import { PERMISSIONS } from '@/lib/rbac'
import type { PermissionCode } from '@/types/database'

const useAuthMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/auth/auth-context', () => ({ useAuth: useAuthMock }))

function renderGuard(permission: PermissionCode = PERMISSIONS.CRM_VIEW) {
  return render(
    <MemoryRouter initialEntries={['/protegida']}>
      <Routes>
        <Route path="/login" element={<div>Página de login</div>} />
        <Route path="/protegida" element={<PermissionRoute permission={permission}><div>Conteúdo protegido</div></PermissionRoute>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PermissionRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'user-1' } }, permissions: [], loading: false })
  })

  it('renderiza a rota quando o usuário possui a permissão', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'user-1' } }, permissions: ['crm.view'], loading: false })
    renderGuard()
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })

  it('exibe 403 amigável sem revelar detalhes internos', () => {
    renderGuard()
    expect(screen.getByRole('heading', { name: 'Você não tem acesso a esta área' })).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    expect(screen.queryByText(/crm\.view/i)).not.toBeInTheDocument()
  })

  it('não renderiza conteúdo enquanto o acesso está carregando', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'user-1' } }, permissions: ['crm.view'], loading: true })
    renderGuard()
    expect(screen.getByRole('status', { name: 'Validando acesso' })).toBeInTheDocument()
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
  })

  it('redireciona usuário não autenticado para o login', () => {
    useAuthMock.mockReturnValue({ session: null, permissions: [], loading: false })
    renderGuard()
    expect(screen.getByText('Página de login')).toBeInTheDocument()
  })

  it('permite consultar cursos com courses.view', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'user-1' } }, permissions: ['courses.view'], loading: false })
    renderGuard(PERMISSIONS.COURSES_VIEW)
    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
  })

  it('não trata crm.view como acesso implícito aos cursos', () => {
    useAuthMock.mockReturnValue({ session: { user: { id: 'user-1' } }, permissions: ['crm.view'], loading: false })
    renderGuard(PERMISSIONS.COURSES_VIEW)
    expect(screen.getByRole('heading', { name: 'Você não tem acesso a esta área' })).toBeInTheDocument()
  })
})
