type SecretEnvironment = {
  get(name: string): string | undefined
}

export function getSupabaseSecretKey(env: SecretEnvironment = Deno.env): string {
  const raw = env.get('SUPABASE_SECRET_KEYS')
  if (!raw) throw new Error('Missing SUPABASE_SECRET_KEYS')

  let keys: unknown
  try {
    keys = JSON.parse(raw)
  } catch {
    throw new Error('Invalid SUPABASE_SECRET_KEYS')
  }

  const secretKey = (keys as { default?: unknown } | null)?.default
  if (typeof secretKey !== 'string' || secretKey.length === 0) {
    throw new Error('Missing default Supabase secret key')
  }

  return secretKey
}
