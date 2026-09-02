import { LoaderCircle, LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, useSearchParams } from 'react-router-dom'
import { Card, EmptyState } from '@/components/ui/core'
import { LoginPage, RecoveryPage, ResetPasswordPage } from '@/features/auth/auth-pages'
import { useAuth } from '@/features/auth/auth-context'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ProfilePage, UsersPage } from '@/features/users/users-pages'
import { AppShell } from '@/layouts/app-shell'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center bg-canvas"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-navy" /><p className="mt-3 text-sm text-muted">Validando sessão...</p></div></div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

function ComingSoonPage() { const [params] = useSearchParams(); const module = params.get('modulo') || 'Módulo'; return <Card><EmptyState icon={LockKeyhole} title={`${module} em preparação`} description="A fundação está pronta para receber este módulo em uma próxima etapa." /></Card> }

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/recuperar-senha', element: <RecoveryPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  { path: '/', element: <ProtectedRoute><AppShell /></ProtectedRoute>, children: [
    { index: true, element: <DashboardPage /> },
    { path: 'perfil', element: <ProfilePage /> },
    { path: 'administracao/usuarios', element: <UsersPage /> },
    { path: 'em-breve', element: <ComingSoonPage /> },
    { path: '*', element: <Navigate to="/" replace /> }
  ] }
])
