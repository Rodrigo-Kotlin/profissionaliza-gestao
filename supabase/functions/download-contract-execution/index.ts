import { createClient } from 'npm:@supabase/supabase-js@2.56.1'
import { getSupabaseSecretKey } from '../_shared/supabase-admin.ts'
import { corsHeaders, originIsPresentAndDenied } from '../_shared/cors.ts'

const json = (body: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' }
})

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin')
  if (originIsPresentAndDenied(origin)) return json({ error: 'Origin not allowed' }, 403, origin)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization) return json({ error: 'Authentication required' }, 401, origin)
  if (!supabaseUrl || !anonKey) return json({ error: 'Server configuration error' }, 500, origin)

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  let adminClient: ReturnType<typeof createClient>
  try {
    adminClient = createClient(supabaseUrl, getSupabaseSecretKey())
  } catch {
    return json({ error: 'Server configuration error' }, 500, origin)
  }
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401, origin)
  const { data: permissions, error: permissionError } = await userClient.rpc('get_my_permissions')
  const permissionSet = new Set((permissions as string[] | null) ?? [])
  if (permissionError || !permissionSet.has('contracts.execution.view') || !permissionSet.has('contracts.view_sensitive')) {
    return json({ error: 'Execution not found or not authorized' }, 404, origin)
  }

  let body: { execution_id?: string }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, 400, origin) }
  if (!body.execution_id) return json({ error: 'execution_id is required' }, 400, origin)

  const { data: detail, error: detailError } = await userClient.rpc('get_contract_execution_detail', {
    p_execution_id: body.execution_id
  })
  if (detailError || !detail) return json({ error: 'Execution not found or not authorized' }, 404, origin)
  const execution = detail as { status?: string; signed_file_path?: string | null }
  if (!['RECEIVED', 'VERIFIED'].includes(execution.status ?? '') || !execution.signed_file_path) {
    return json({ error: 'Execution file is not available' }, 409, origin)
  }

  const { data: signed, error: signedError } = await adminClient.storage
    .from('contract-documents')
    .createSignedUrl(execution.signed_file_path, 300)
  if (signedError || !signed?.signedUrl) return json({ error: 'Unable to create download URL' }, 502, origin)
  return json({ signed_url: signed.signedUrl, expires_in: 300 }, 200, origin)
})
