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
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization) return json({ error: 'Authentication required' }, 401, origin)
  if (!url || !anonKey) return json({ error: 'Server configuration error' }, 500, origin)

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  let adminClient: ReturnType<typeof createClient>
  try {
    adminClient = createClient(url, getSupabaseSecretKey())
  } catch {
    return json({ error: 'Server configuration error' }, 500, origin)
  }
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401, origin)

  const { data: permissions, error: permissionError } = await userClient.rpc('get_my_permissions')
  const canViewDocuments = (permissions as string[] | null)?.includes('contracts.documents.view')
  const canViewSensitive = (permissions as string[] | null)?.includes('contracts.view_sensitive')
  if (permissionError || !canViewDocuments || !canViewSensitive) {
    return json({ error: 'Document not found or not authorized' }, 404, origin)
  }

  let body: { document_id?: string }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, 400, origin) }
  if (!body.document_id) return json({ error: 'document_id is required' }, 400, origin)

  const { data: detail, error: detailError } = await userClient.rpc('get_contract_document_detail', { p_document_id: body.document_id })
  if (detailError || !detail) return json({ error: 'Document not found or not authorized' }, 404, origin)
  const document = detail as { status?: string; original_file_path?: string | null }
  if (document.status !== 'FINAL' || !document.original_file_path) return json({ error: 'Document is not available for download' }, 409, origin)

  const { data: signed, error: signedError } = await adminClient.storage
    .from('contract-documents')
    .createSignedUrl(document.original_file_path, 300)
  if (signedError || !signed?.signedUrl) return json({ error: 'Unable to create download URL' }, 502, origin)
  return json({ signed_url: signed.signedUrl, expires_in: 300 }, 200, origin)
})
