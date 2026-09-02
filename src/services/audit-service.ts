import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database.types'
import type { AuditAction } from '@/types/database'

type AuditMetadata = Record<string, unknown>

export async function writeAuditLog(
  action: AuditAction,
  entityType: string,
  entityId?: string,
  metadata: AuditMetadata = {}
) {
  const { error } = await supabase.rpc('write_audit_log', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId ?? undefined,
    p_metadata: metadata as Json
  })
  if (error) console.warn('Não foi possível registrar auditoria:', error.message)
}