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
  | 'crm.view_all'
  | 'crm.create'
  | 'crm.edit'
  | 'crm.assign'
  | 'crm.move_stage'
  | 'crm.close_lost'
  | 'crm.activities.manage'
  | 'crm.activities.manage_all'
  | 'crm.manage_catalog'
  | 'crm.reports'
  | 'courses.view'
  | 'courses.manage'
  | 'course_offers.view'
  | 'course_offers.manage'
  | 'course_offers.activate'
  | 'price_plans.view'
  | 'price_plans.manage'
  | 'price_plans.activate'
  | 'sales.view'
  | 'sales.view_all'
  | 'sales.create'
  | 'sales.approve'
  | 'sales.cancel'
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
  | 'rbac.view'
  | 'reports.view'
  | 'reports.export'
  | 'audit.view'
  | 'settings.view'
  | 'settings.manage'
  | 'people.view'
  | 'people.create'
  | 'people.edit'
  | 'students.view'
  | 'students.create'
  | 'students.edit'
  | 'students.manage_status'
  | 'students.view_sensitive'
  | 'guardians.view'
  | 'guardians.manage'
  | 'contracts.view'
  | 'contracts.view_all'
  | 'contracts.view_sensitive'
  | 'contracts.create'
  | 'contracts.edit_draft'
  | 'contracts.issue'
  | 'contracts.mark_signed'
  | 'contracts.cancel'
  | 'contracts.documents.view'
  | 'contracts.documents.generate'
  | 'contracts.documents.supersede'
  | 'contracts.execution.view'
  | 'contracts.execution.upload'
  | 'contracts.execution.verify'
  | 'contracts.execution.reject'
  | 'enrollments.view'
  | 'enrollments.view_all'
  | 'enrollments.create'
  | 'enrollments.activate'
  | 'enrollments.pause'
  | 'enrollments.resume'
  | 'enrollments.complete'
  | 'enrollments.cancel'

export type CommercialStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'

export type CommercialOfferType = 'COURSE' | 'ONLINE_CATALOG' | 'PROGRAM' | 'SERVICE' | 'MODULE' | 'OTHER'

export type CommercialPaymentMethod = 'PIX' | 'CASH' | 'DEBIT' | 'BOLETO' | 'CREDIT_CARD' | 'OTHER'

export type CommercialPricingModel = 'CASH' | 'FIXED_INSTALLMENT' | 'EXPLICIT_CARD_INSTALLMENT' | 'QUANTITY_TIER'

export type CommercialOffer = {
  id: string
  code: string
  name: string
  course_id: string | null
  offer_type: CommercialOfferType
  status: CommercialStatus
  valid_from: string
  valid_until: string | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type CommercialPricePlan = {
  id: string
  code: string
  offer_id: string
  payment_method: CommercialPaymentMethod
  pricing_model: CommercialPricingModel
  cash_price: number | null
  enrollment_fee: number | null
  installment_count: number | null
  installment_amount: number | null
  total_amount: number
  quantity_min: number | null
  quantity_max: number | null
  status: CommercialStatus
  valid_from: string
  valid_until: string | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type CommercialOfferItem = {
  id: string
  offer_id: string
  course_id: string
  selection_mode: 'INCLUDED' | 'SELECTABLE'
  min_quantity: number | null
  max_quantity: number | null
  sort_order: number
  created_at: string
}

export type CommercialPricePlanInstallment = {
  id: string
  price_plan_id: string
  installment_number: number
  due_offset_days: number | null
  amount: number
  created_at: string
}

export type CommercialSaleSnapshot = {
  course_workload_snapshot?: number | null
  course_modality_snapshot?: 'PRESENCIAL' | 'ONLINE' | 'HIBRIDO' | null
  offer_id: string | null
  price_plan_id: string | null
  offer_code_snapshot: string | null
  offer_name_snapshot: string | null
  offer_type_snapshot: CommercialOfferType | string | null
  price_plan_code_snapshot: string | null
  payment_method_snapshot: CommercialPaymentMethod | string | null
  pricing_model_snapshot: CommercialPricingModel | string | null
  installment_count_snapshot: number | null
  installment_amount_snapshot: number | null
  quantity_min_snapshot: number | null
  quantity_max_snapshot: number | null
  cash_price_snapshot: number | null
  enrollment_fee_snapshot: number | null
  total_amount_snapshot: number | null
}

export type AuditAction =
  | 'auth.login'
  | 'auth.logout'
  | 'profile.update'
  | 'administration.update'
  | 'student.created'
  | 'student.updated'
  | 'student.status_changed'
  | 'guardian.linked'
  | 'guardian.updated'
  | 'guardian.unlinked'
  | 'crm.lead_created'
  | 'crm.lead_updated'
  | 'crm.lead_assigned'
  | 'crm.stage_changed'
  | 'crm.activity_created'
  | 'crm.activity_completed'
  | 'crm.activity_rescheduled'
  | 'crm.lead_lost'
  | 'crm.lead_won'
  | 'crm.course_created'
  | 'crm.course_updated'
  | 'sales.created'
  | 'sales.canceled'
  | 'people.created'
  | 'people.reused'
  | 'contracts.created'
  | 'contracts.updated_draft'
  | 'contracts.issued'
  | 'contracts.signed'
  | 'contracts.canceled'
  | 'contract.document_draft_created'
  | 'contract.document_generated'
  | 'contract.document_finalized'
  | 'enrollment.created'
  | 'enrollment.activated'
  | 'enrollment.paused'
  | 'enrollment.resumed'
  | 'enrollment.completed'
  | 'enrollment.canceled'
