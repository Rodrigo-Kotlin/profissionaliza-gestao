import { supabase } from '@/lib/supabase'

export type SessionAuditEvent = 'auth.login' | 'auth.logout'

export async function logSessionEvent(eventType: SessionAuditEvent) {
  if (eventType !== 'auth.login' && eventType !== 'auth.logout') return

  try {
    const { error } = await supabase.rpc('log_session_event', { p_event_type: eventType })
    if (error) console.warn('Não foi possível registrar o evento de sessão.')
  } catch {
    console.warn('Não foi possível registrar o evento de sessão.')
  }
}
