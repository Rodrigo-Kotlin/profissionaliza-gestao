export type Profile = {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type RoleCode =
  | 'ADMIN'
  | 'DIRECAO'
  | 'GERENTE_COMERCIAL'
  | 'VENDEDOR'
  | 'FINANCEIRO'
  | 'PEDAGOGICO'
  | 'PROFESSOR'
  | 'RECEPCAO'

export type PermissionCode =
  | 'dashboard.view'
  | 'crm.view'
  | 'crm.create'
  | 'crm.edit'
  | 'sales.view'
  | 'sales.create'
  | 'sales.approve'
  | 'finance.view'
  | 'finance.create'
  | 'finance.receive'
  | 'finance.export'
  | 'academic.view'
  | 'academic.manage'
  | 'attendance.create'
  | 'commissions.view'
  | 'commissions.approve'
  | 'users.view'
  | 'users.manage'
  | 'reports.view'
  | 'reports.export'
  | 'audit.view'
  | 'settings.view'
  | 'settings.manage'

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'profile.update'
  | 'administration.update'
