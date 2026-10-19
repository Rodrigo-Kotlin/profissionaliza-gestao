export type AppEnvironment = 'development' | 'production'

const VALID_ENVIRONMENTS = ['development', 'production'] as const

function readRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_APP_ENV') {
  const value = import.meta.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function parseEnvironment(value: string): AppEnvironment {
  if (!VALID_ENVIRONMENTS.includes(value as AppEnvironment)) {
    throw new Error(`Invalid VITE_APP_ENV "${value}". Expected development or production.`)
  }
  return value as AppEnvironment
}

function deriveProjectRef(url: string) {
  const hostname = new URL(url).hostname
  const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
  return match?.[1] ?? null
}

const rawEnvironment = readRequiredEnv('VITE_APP_ENV').toLowerCase()
const supabaseUrl = readRequiredEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = readRequiredEnv('VITE_SUPABASE_ANON_KEY')

try {
  new URL(supabaseUrl)
} catch {
  throw new Error('VITE_SUPABASE_URL must be a valid URL')
}

export const environment = parseEnvironment(rawEnvironment)
export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  projectRef: deriveProjectRef(supabaseUrl)
} as const

export const isDevelopment = environment === 'development'
