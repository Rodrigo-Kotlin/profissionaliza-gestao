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
  AUDIT_VIEW: 'audit.view',
  PEOPLE_VIEW: 'people.view',
  PEOPLE_CREATE: 'people.create',
  PEOPLE_EDIT: 'people.edit',
  STUDENTS_VIEW: 'students.view',
  STUDENTS_CREATE: 'students.create',
  STUDENTS_EDIT: 'students.edit',
  STUDENTS_MANAGE_STATUS: 'students.manage_status',
  STUDENTS_VIEW_SENSITIVE: 'students.view_sensitive',
  GUARDIANS_VIEW: 'guardians.view',
  GUARDIANS_MANAGE: 'guardians.manage',
  CRM_VIEW: 'crm.view',
  CRM_VIEW_ALL: 'crm.view_all',
  CRM_CREATE: 'crm.create',
  CRM_EDIT: 'crm.edit',
  CRM_ASSIGN: 'crm.assign',
  CRM_MOVE_STAGE: 'crm.move_stage',
  CRM_CLOSE_LOST: 'crm.close_lost',
  CRM_ACTIVITIES_MANAGE: 'crm.activities.manage',
  CRM_ACTIVITIES_MANAGE_ALL: 'crm.activities.manage_all',
  CRM_MANAGE_CATALOG: 'crm.manage_catalog',
  CRM_REPORTS: 'crm.reports',
  COURSES_VIEW: 'courses.view',
  COURSES_MANAGE: 'courses.manage'
} as const satisfies Record<string, PermissionCode>

export const can = (permissions: readonly string[], permission: PermissionCode) =>
  permissions.includes(permission)

export const STUDENT_STATUSES = ['PRE_CADASTRO', 'ATIVO', 'INATIVO', 'CANCELADO', 'CONCLUIDO'] as const
export type StudentStatus = (typeof STUDENT_STATUSES)[number]

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  PRE_CADASTRO: 'Pré-cadastro',
  ATIVO: 'Ativo',
  INATIVO: 'Inativo',
  CANCELADO: 'Cancelado',
  CONCLUIDO: 'Concluído'
}

export const GUARDIAN_RELATIONSHIPS = ['PAI', 'MAE', 'AVO', 'AVO_A', 'CONJUGE', 'IRMAO', 'IRMA', 'TUTOR', 'RESPONSAVEL_LEGAL', 'OUTRO'] as const
export const GUARDIAN_RELATIONSHIP_LABELS: Record<string, string> = {
  PAI: 'Pai',
  MAE: 'Mãe',
  AVO: 'Avô',
  AVO_A: 'Avó',
  CONJUGE: 'Cônjuge',
  IRMAO: 'Irmão',
  IRMA: 'Irmã',
  TUTOR: 'Tutor',
  RESPONSAVEL_LEGAL: 'Responsável legal',
  OUTRO: 'Outro'
}

export const STUDENT_ORIGINS = ['SITE', 'WHATSAPP', 'INSTAGRAM', 'PRESENCIAL', 'INDICACAO', 'OUTRO'] as const
export const STUDENT_ORIGIN_LABELS: Record<string, string> = {
  SITE: 'Site',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  PRESENCIAL: 'Presencial',
  INDICACAO: 'Indicação',
  OUTRO: 'Outro'
}

export const canAny = (permissions: readonly string[], ...required: PermissionCode[]) =>
  required.some((permission) => permissions.includes(permission))
