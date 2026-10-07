import { createClient } from 'npm:@supabase/supabase-js@2.56.1'
import {
  buildContractDocumentPayload,
  canonicalize,
  CONTRACT_DOCUMENT_TYPE,
  CONTRACT_TEMPLATE_VERSION,
  sha256Hex,
  type ContractDocumentContract
} from '../_shared/contract-document.ts'
import { getInstitutionSnapshot } from '../_shared/institution.ts'
import { renderContractPdf } from '../_shared/contract-pdf.ts'

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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration error' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401)

  const { data: permissions, error: permissionError } = await userClient.rpc('get_my_permissions')
  if (permissionError || !(permissions as string[] | null)?.includes('contracts.documents.generate')) {
    return json({ error: 'Permission denied' }, 403)
  }

  let body: { contract_id?: string }
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  if (!body.contract_id) return json({ error: 'contract_id is required' }, 400)

  const { data: contractData, error: contractError } = await userClient.rpc('get_contract_detail', { p_contract_id: body.contract_id })
  if (contractError || !contractData) return json({ error: 'Contract not found or not authorized' }, 404)
  const contract = contractData as unknown as ContractDocumentContract
  if (contract.status !== 'DRAFT') return json({ error: 'Only draft contracts can generate documents' }, 409)

  const { data: existingData, error: existingError } = await userClient.rpc('list_contract_documents', { p_contract_id: body.contract_id })
  if (existingError) return json({ error: 'Unable to read contract documents' }, 502)
  const existing = (existingData as { data?: Array<Record<string, unknown>> } | null)?.data ?? []
  const finalDocument = existing.find((document) => document.status === 'FINAL')
  if (finalDocument) return json({ document: finalDocument, idempotent: true })

  const payloadBase = buildContractDocumentPayload(contract, getInstitutionSnapshot(Deno.env))
  const payloadForDraft = payloadBase
  const { data: draftData, error: draftError } = await userClient.rpc('get_or_create_contract_document_draft', {
    p_contract_id: body.contract_id,
    p_document_type: CONTRACT_DOCUMENT_TYPE,
    p_template_version: CONTRACT_TEMPLATE_VERSION,
    p_document_payload: payloadForDraft
  })
  if (draftError || !draftData) return json({ error: 'Unable to prepare document draft' }, 502)
  const draft = draftData as { document_id: string; document_code: string; version: number; status: string }
  if (draft.status === 'FINAL') return json({ document: draft, idempotent: true })

  const payload = buildContractDocumentPayload(contract, getInstitutionSnapshot(Deno.env), draft.version, draft.document_code)
  const canonicalPayload = canonicalize(payload)
  const canonicalPayloadHash = await sha256Hex(canonicalPayload)
  payload.document.canonicalPayloadHash = canonicalPayloadHash
  const pdfBytes = await renderContractPdf(payload)
  const originalSha256 = await sha256Hex(pdfBytes)
  const path = `contracts/${body.contract_id}/v${draft.version}/original.pdf`

  let uploadError = (await adminClient.storage.from('contract-documents').upload(path, pdfBytes, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false
  })).error
  if (uploadError) {
    await adminClient.storage.from('contract-documents').remove([path])
    uploadError = (await adminClient.storage.from('contract-documents').upload(path, pdfBytes, {
      contentType: 'application/pdf', cacheControl: '3600', upsert: false
    })).error
  }
  if (uploadError) {
    console.error('contract document upload failed', { code: uploadError.name ?? 'storage_error' })
    return json({ error: 'Unable to store contract document' }, 502)
  }

  const { data: finalizedData, error: finalizeError } = await userClient.rpc('finalize_contract_document', {
    p_document_id: draft.document_id,
    p_document_payload: payload,
    p_canonical_payload_hash: canonicalPayloadHash,
    p_original_file_path: path,
    p_original_file_name: 'original.pdf',
    p_original_file_size: pdfBytes.byteLength,
    p_original_sha256: originalSha256
  })
  if (finalizeError || !finalizedData) {
    await adminClient.storage.from('contract-documents').remove([path])
    console.error('contract document finalization failed', { code: finalizeError?.code ?? 'database_error' })
    return json({ error: 'Unable to finalize contract document' }, 502)
  }

  return json({ document: finalizedData, idempotent: false })
})
