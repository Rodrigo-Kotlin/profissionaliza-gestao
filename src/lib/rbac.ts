import type { PermissionCode, RoleCode } from '@/types/database'

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Administrador',
  DIRECAO: 'Direção',
  GERENTE_COMERCIAL: 'Gerente comercial',
  VENDEDOR: 'Vendedor',
  FINANCEIRO: 'Financeiro',
  PEDAGOGICO: 'Pedagógico',
  PROFESSOR: 'Professor',
  RECEPCAO: 'Recepção'
}

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  AUDIT_VIEW: 'audit.view'
} as const satisfies Record<string, PermissionCode>

export const can = (permissions: readonly string[], permission: PermissionCode) =>
  permissions.includes(permission)
