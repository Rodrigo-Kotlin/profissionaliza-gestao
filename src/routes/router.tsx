import { Suspense, lazy } from 'react'
import { LoaderCircle, LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, useSearchParams } from 'react-router-dom'
import { Card, EmptyState } from '@/components/ui/core'
import { LoginPage, RecoveryPage, ResetPasswordPage } from '@/features/auth/auth-pages'
import { useAuth } from '@/features/auth/auth-context'
import { AppShell } from '@/layouts/app-shell'

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })))
const ProfilePage = lazy(() => import('@/features/users/users-pages').then((m) => ({ default: m.ProfilePage })))
const UsersPage = lazy(() => import('@/features/users/users-pages').then((m) => ({ default: m.UsersPage })))
const StudentsPage = lazy(() => import('@/features/students/students-page').then((m) => ({ default: m.StudentsPage })))
const StudentForm = lazy(() => import('@/features/students/student-form').then((m) => ({ default: m.StudentForm })))
const StudentDetailsPage = lazy(() => import('@/features/students/student-details-page').then((m) => ({ default: m.StudentDetailsPage })))
const StudentEditPage = lazy(() => import('@/features/students/student-edit-page').then((m) => ({ default: m.StudentEditPage })))

function PageSkeleton() {
  return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-navy" /></div>
}

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
    { index: true, element: <Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense> },
    { path: 'perfil', element: <Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense> },
    { path: 'administracao/usuarios', element: <Suspense fallback={<PageSkeleton />}><UsersPage /></Suspense> },
    { path: 'alunos', element: <Suspense fallback={<PageSkeleton />}><StudentsPage /></Suspense> },
    { path: 'alunos/novo', element: <Suspense fallback={<PageSkeleton />}><StudentForm /></Suspense> },
    { path: 'alunos/:id', element: <Suspense fallback={<PageSkeleton />}><StudentDetailsPage /></Suspense> },
    { path: 'alunos/:id/editar', element: <Suspense fallback={<PageSkeleton />}><StudentEditPage /></Suspense> },
    { path: 'em-breve', element: <ComingSoonPage /> },
    { path: '*', element: <Navigate to="/" replace /> }
  ] }
])
