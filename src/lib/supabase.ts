import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

import { supabaseConfig } from '@/config/environment'

export const isSupabaseConfigured = true

export const supabase = createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'profissionaliza-auth'
  }
})
