import { LoaderCircle, ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Card } from '@/components/ui/core'
import { useAuth } from '@/features/auth/auth-context'
import { can, canAny } from '@/lib/rbac'
import type { PermissionCode } from '@/types/database'

export function RouteLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas" role="status" aria-label="Validando acesso">
      <div className="text-center">
        <LoaderCircle className="mx-auto size-8 animate-spin text-navy" />
        <p className="mt-3 text-sm text-muted">Validando acesso...</p>
      </div>
    </div>
  )
}

export function AuthRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <RouteLoading />
  if (!session) return <Navigate to="/login" replace />
  return children
}

type PermissionRouteProps = {
  children: ReactNode
  permission?: PermissionCode
  anyOf?: readonly PermissionCode[]
}

export function PermissionRoute({ children, permission, anyOf }: PermissionRouteProps) {
  const { session, permissions, loading } = useAuth()
  if (loading) return <RouteLoading />
  if (!session) return <Navigate to="/login" replace />

  const allowed = permission
    ? can(permissions, permission)
    : Boolean(anyOf?.length && canAny(permissions, ...anyOf))

  if (!allowed) return <AccessDeniedPage />
  return children
}

export function AccessDeniedPage() {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center sm:p-10">
      <ShieldX className="mx-auto size-10 text-slate-400" aria-hidden />
      <h1 className="mt-4 text-xl font-bold text-ink">Você não tem acesso a esta área</h1>
      <p className="mt-2 text-sm text-muted">Solicite acesso a um administrador do sistema.</p>
      <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-navy px-4 text-sm font-semibold text-white hover:bg-navy/90" to="/">
        Voltar ao início
      </Link>
    </Card>
  )
}
