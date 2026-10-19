import { createClient } from 'npm:@supabase/supabase-js@2.56.1'
import { getSupabaseSecretKey } from '../_shared/supabase-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const MAX_FILE_SIZE = 20 * 1024 * 1024

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

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
  if (permissionError || !permissionSet.has('contracts.execution.upload') || !permissionSet.has('contracts.view_sensitive')) {
    return json({ error: 'Permission denied' }, 403)
  }

  let form: FormData
  try { form = await request.formData() } catch { return json({ error: 'Invalid multipart form' }, 400) }
  const executionId = String(form.get('execution_id') ?? '').trim()
  const file = form.get('file')
  if (!executionId || !(file instanceof File)) return json({ error: 'execution_id and file are required' }, 400)
  if (file.type !== 'application/pdf') return json({ error: 'Only application/pdf is accepted' }, 415)
  if (file.size < 1 || file.size > MAX_FILE_SIZE) return json({ error: 'PDF exceeds the 20 MiB limit' }, 413)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const magic = new TextDecoder().decode(bytes.slice(0, 5))
  if (magic !== '%PDF-') return json({ error: 'File is not a valid PDF' }, 415)
  const sha256 = await sha256Hex(bytes)

  const { data: executionData, error: executionError } = await userClient.rpc('get_contract_execution_detail', {
    p_execution_id: executionId
  })
  if (executionError || !executionData) return json({ error: 'Execution not found or not authorized' }, 404)
  const execution = executionData as { status?: string; execution_method?: string; contract_document_id?: string }
  if (execution.status !== 'PENDING_UPLOAD') return json({ error: 'Execution is not pending upload' }, 409)
  if (!['GOV_BR', 'PHYSICAL'].includes(execution.execution_method ?? '')) {
    return json({ error: 'Execution method is not implemented in this phase' }, 409)
  }

  const { data: documentData, error: documentError } = await userClient.rpc('get_contract_document_detail', {
    p_document_id: execution.contract_document_id
  })
  if (documentError || !documentData) return json({ error: 'Document not found or not authorized' }, 404)
  const document = documentData as { contract_id?: string; version?: number; status?: string }
  if (document.status !== 'FINAL' || !document.contract_id || !document.version) {
    return json({ error: 'Only final documents can receive formalizations' }, 409)
  }

  const path = `contracts/${document.contract_id}/v${document.version}/executions/${executionId}/signed.pdf`
  const { error: uploadError } = await adminClient.storage.from('contract-documents').upload(path, bytes, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false,
    metadata: { mimetype: 'application/pdf', size: String(file.size), sha256 }
  })
  if (uploadError) {
    console.error('contract execution upload failed', { code: uploadError.name ?? 'storage_error' })
    return json({ error: 'Unable to store contract execution' }, 502)
  }

  const signedAtRaw = String(form.get('signed_at') ?? '').trim()
  if (signedAtRaw && Number.isNaN(Date.parse(signedAtRaw))) {
    await adminClient.storage.from('contract-documents').remove([path])
    return json({ error: 'signed_at is invalid' }, 400)
  }
  const signedAt = signedAtRaw ? new Date(signedAtRaw).toISOString() : null
  let evidence: Record<string, unknown> | null = null
  const evidenceRaw = String(form.get('evidence_json') ?? '').trim()
  if (evidenceRaw) {
    try {
      const parsed = JSON.parse(evidenceRaw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not_object')
      evidence = parsed as Record<string, unknown>
    } catch {
      await adminClient.storage.from('contract-documents').remove([path])
      return json({ error: 'evidence_json must be a JSON object' }, 400)
    }
  }

  const { data: receivedData, error: receiveError } = await userClient.rpc('receive_contract_execution', {
    p_execution_id: executionId,
    p_signed_file_path: path,
    p_signed_file_name: file.name || 'signed.pdf',
    p_signed_file_size: file.size,
    p_signed_sha256: sha256,
    p_signed_at: signedAt,
    p_evidence_json: evidence
  })
  if (receiveError || !receivedData) {
    await adminClient.storage.from('contract-documents').remove([path])
    console.error('contract execution receive failed', { code: (receiveError as { code?: string } | null)?.code ?? 'database_error' })
    return json({ error: 'Unable to register contract execution' }, 502)
  }

  return json(receivedData)
})
