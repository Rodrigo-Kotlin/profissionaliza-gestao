import { supabase } from '@/lib/supabase'
import type { AuditAction } from '@/types/database'

export async function writeAuditLog(action: AuditAction, entityType: string, entityId?: string) {
  const { error } = await supabase.rpc('write_audit_log', {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId ?? undefined,
    p_metadata: {}
  })
  if (error) console.warn('Não foi possível registrar auditoria:', error.message)
}
