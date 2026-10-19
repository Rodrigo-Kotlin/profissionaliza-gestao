import { createClient } from 'npm:@supabase/supabase-js@2.56.1'
import { getSupabaseSecretKey } from '../_shared/supabase-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('Authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization) return json({ error: 'Authentication required' }, 401)
  if (!supabaseUrl || !anonKey) return json({ error: 'Server configuration error' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  let adminClient: ReturnType<typeof createClient>
  try {
    adminClient = createClient(supabaseUrl, getSupabaseSecretKey())
  } catch {
    return json({ error: 'Server configuration error' }, 500)
  }
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401)
  const { data: permissions, error: permissionError } = await userClient.rpc('get_my_permissions')
  const permissionSet = new Set((permissions as string[] | null) ?? [])
  if (permissionError || !permissionSet.has('contracts.execution.view') || !permissionSet.has('contracts.view_sensitive')) {
    return json({ error: 'Execution not found or not authorized' }, 404)
  }

  let body: { execution_id?: string }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  if (!body.execution_id) return json({ error: 'execution_id is required' }, 400)

  const { data: detail, error: detailError } = await userClient.rpc('get_contract_execution_detail', {
    p_execution_id: body.execution_id
  })
  if (detailError || !detail) return json({ error: 'Execution not found or not authorized' }, 404)
  const execution = detail as { status?: string; signed_file_path?: string | null }
  if (!['RECEIVED', 'VERIFIED'].includes(execution.status ?? '') || !execution.signed_file_path) {
    return json({ error: 'Execution file is not available' }, 409)
  }

  const { data: signed, error: signedError } = await adminClient.storage
    .from('contract-documents')
    .createSignedUrl(execution.signed_file_path, 300)
  if (signedError || !signed?.signedUrl) return json({ error: 'Unable to create download URL' }, 502)
  return json({ signed_url: signed.signedUrl, expires_in: 300 })
})
