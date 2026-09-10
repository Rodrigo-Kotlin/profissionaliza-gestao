import { Suspense, lazy } from 'react'
import { LoaderCircle, LockKeyhole } from 'lucide-react'
import { createBrowserRouter, Navigate, useSearchParams } from 'react-router-dom'
import { Card, EmptyState } from '@/components/ui/core'
import { LoginPage, RecoveryPage, ResetPasswordPage } from '@/features/auth/auth-pages'
import { AppShell } from '@/layouts/app-shell'
import { PERMISSIONS } from '@/lib/rbac'
import { AuthRoute, PermissionRoute } from './permission-route'

const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })))
const ProfilePage = lazy(() => import('@/features/users/users-pages').then((m) => ({ default: m.ProfilePage })))
const UsersPage = lazy(() => import('@/features/users/users-pages').then((m) => ({ default: m.UsersPage })))
const StudentsPage = lazy(() => import('@/features/students/students-page').then((m) => ({ default: m.StudentsPage })))
const StudentForm = lazy(() => import('@/features/students/student-form').then((m) => ({ default: m.StudentForm })))
const StudentDetailsPage = lazy(() => import('@/features/students/student-details-page').then((m) => ({ default: m.StudentDetailsPage })))
const StudentEditPage = lazy(() => import('@/features/students/student-edit-page').then((m) => ({ default: m.StudentEditPage })))
const CrmPage = lazy(() => import('@/features/crm/crm-page').then((m) => ({ default: m.CrmPage })))
const LeadsPage = lazy(() => import('@/features/crm/leads-page').then((m) => ({ default: m.LeadsPage })))
const LeadDetailsPage = lazy(() => import('@/features/crm/lead-details-page').then((m) => ({ default: m.LeadDetailsPage })))
const ActivitiesPage = lazy(() => import('@/features/crm/activities-page').then((m) => ({ default: m.ActivitiesPage })))
const CourseCatalog = lazy(() => import('@/features/crm/course-catalog').then((m) => ({ default: m.CourseCatalog })))

function PageSkeleton() {
  return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-navy" /></div>
}

function ComingSoonPage() { const [params] = useSearchParams(); const module = params.get('modulo') || 'Módulo'; return <Card><EmptyState icon={LockKeyhole} title={`${module} em preparação`} description="A fundação está pronta para receber este módulo em uma próxima etapa." /></Card> }

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/recuperar-senha', element: <RecoveryPage /> },
  { path: '/redefinir-senha', element: <ResetPasswordPage /> },
  { path: '/', element: <AuthRoute><AppShell /></AuthRoute>, children: [
    { index: true, element: <PermissionRoute permission={PERMISSIONS.DASHBOARD_VIEW}><Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense></PermissionRoute> },
    { path: 'perfil', element: <Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense> },
    { path: 'administracao/usuarios', element: <PermissionRoute anyOf={[PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE]}><Suspense fallback={<PageSkeleton />}><UsersPage /></Suspense></PermissionRoute> },
    { path: 'alunos', element: <PermissionRoute permission={PERMISSIONS.STUDENTS_VIEW}><Suspense fallback={<PageSkeleton />}><StudentsPage /></Suspense></PermissionRoute> },
    { path: 'alunos/novo', element: <PermissionRoute permission={PERMISSIONS.STUDENTS_CREATE}><Suspense fallback={<PageSkeleton />}><StudentForm /></Suspense></PermissionRoute> },
    { path: 'alunos/:id', element: <PermissionRoute permission={PERMISSIONS.STUDENTS_VIEW}><Suspense fallback={<PageSkeleton />}><StudentDetailsPage /></Suspense></PermissionRoute> },
    { path: 'alunos/:id/editar', element: <PermissionRoute permission={PERMISSIONS.STUDENTS_EDIT}><Suspense fallback={<PageSkeleton />}><StudentEditPage /></Suspense></PermissionRoute> },
    { path: 'crm', element: <PermissionRoute permission={PERMISSIONS.CRM_VIEW}><Suspense fallback={<PageSkeleton />}><CrmPage /></Suspense></PermissionRoute> },
    { path: 'crm/leads', element: <PermissionRoute permission={PERMISSIONS.CRM_VIEW}><Suspense fallback={<PageSkeleton />}><LeadsPage /></Suspense></PermissionRoute> },
    { path: 'crm/leads/novo', element: <PermissionRoute permission={PERMISSIONS.CRM_CREATE}><Suspense fallback={<PageSkeleton />}><LeadsPage /></Suspense></PermissionRoute> },
    { path: 'crm/leads/:id', element: <PermissionRoute permission={PERMISSIONS.CRM_VIEW}><Suspense fallback={<PageSkeleton />}><LeadDetailsPage /></Suspense></PermissionRoute> },
    { path: 'crm/atividades', element: <PermissionRoute permission={PERMISSIONS.CRM_VIEW}><Suspense fallback={<PageSkeleton />}><ActivitiesPage /></Suspense></PermissionRoute> },
    { path: 'crm/cursos', element: <PermissionRoute permission={PERMISSIONS.COURSES_VIEW}><Suspense fallback={<PageSkeleton />}><CourseCatalog /></Suspense></PermissionRoute> },
    { path: 'em-breve', element: <ComingSoonPage /> },
    { path: '*', element: <Navigate to="/" replace /> }
  ] }
])
