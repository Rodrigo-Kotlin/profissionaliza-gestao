import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  permissions: string[]
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const loadAccess = async (userId?: string) => {
    if (!userId) { setProfile(null); setPermissions([]); return }
    const [{ data: profileData }, { data: permissionData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.rpc('get_my_permissions')
    ])
    setProfile(profileData as Profile | null)
    setPermissions((permissionData as string[] | null) ?? [])
  }

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      loadAccess(data.session?.user.id).finally(() => active && setLoading(false))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadAccess(nextSession?.user.id)
      setLoading(false)
    })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  const refreshProfile = async () => loadAccess(session?.user.id)
  const signOut = async () => { await supabase.auth.signOut() }
  return <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, permissions, loading, refreshProfile, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return value
}
