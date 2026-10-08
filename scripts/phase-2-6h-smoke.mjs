/* global console, fetch, process, setTimeout */

import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const restrictedEmail = process.env.E2E_EMAIL_RESTRICTED
const restrictedPassword = process.env.E2E_PASSWORD_RESTRICTED
const cleanupKey = process.env.E2E_SECRET_KEY
const runId = `SMOKE-HARDEN-DOC-${Date.now()}`

if (!url || !anonKey || !email || !password || !cleanupKey) throw new Error('DEV smoke credentials are not configured')

const user = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
const admin = createClient(url, cleanupKey, { auth: { autoRefreshToken: false, persistSession: false } })
let contractId = null
let documentId = null
let leadId = null
let saleId = null
let personId = null

const assert = (condition, message) => { if (!condition) throw new Error(message) }
const rpc = async (name, args) => {
  const result = await user.rpc(name, args)
  if (result.error) throw new Error(`${name} failed: ${result.error.code ?? 'rpc_error'}`)
  return result.data
}

try {
  const auth = await user.auth.signInWithPassword({ email, password })
  assert(!auth.error && auth.data.session, 'ADMIN auth failed')
  console.log('login: PASS')

  const courses = await rpc('list_courses', { p_status: 'ACTIVE' })
  const course = courses?.data?.[0] ?? courses?.[0]
  assert(course?.id, 'No active QA course available')
  const stages = await rpc('list_crm_pipeline_stages')
  const stage = stages?.data?.find((item) => item.name === 'Negociação') ?? stages?.find((item) => item.name === 'Negociação')

  leadId = await rpc('create_crm_lead', {
    p_full_name: `QA ${runId}`,
    p_email: `qa+${runId.toLowerCase()}@profissionaliza.test`,
    p_phone: `119${runId.replace(/\D/g, '').slice(-8)}`,
    p_whatsapp: `119${runId.replace(/\D/g, '').slice(-8)}`,
    p_source_code: 'SITE',
    p_course_interest_id: course.id,
    p_stage_id: stage?.id,
    p_commercial_notes: runId
  })
  const lead = await rpc('get_crm_lead_detail', { p_lead_id: leadId })
  personId = lead.person_id
  const sale = await rpc('create_sale_from_lead', {
    p_lead_id: leadId,
    p_course_id: course.id,
    p_gross_value: 1390,
    p_discount_value: 0,
    p_payment_method: 'PIX',
    p_installments: 1,
    p_commercial_notes: runId
  })
  saleId = sale.sale_id ?? sale.id
  await rpc('update_person', { p_person_id: personId, p_postal_code: '01001000', p_street: 'Rua QA Smoke', p_number: '100', p_district: 'Centro', p_city: 'Sao Paulo', p_state: 'SP' })
  const contract = await rpc('create_contract_from_sale', { p_sale_id: saleId, p_contractor_person_id: personId, p_contract_notes: runId })
  contractId = contract.contract_id ?? contract.id
  assert(contractId, 'Contract draft was not created')
  console.log('fixture: PASS')

  const headers = { Authorization: `Bearer ${auth.data.session.access_token}`, apikey: anonKey, 'Content-Type': 'application/json' }
  const generate = await fetch(`${url}/functions/v1/generate-contract-document`, { method: 'POST', headers, body: JSON.stringify({ contract_id: contractId }) })
  assert(generate.ok, `generate HTTP ${generate.status}`)
  const generated = await generate.json()
  const document = generated.document
  documentId = document.document_id ?? document.id
  assert(document.status === 'FINAL', 'document is not FINAL')
  assert(document.version === 1, 'document version is not 1')
  const detailResult = await user.rpc('get_contract_document_detail', { p_document_id: documentId })
  assert(!detailResult.error && detailResult.data, 'document detail failed')
  const metadata = detailResult.data
  assert(metadata.template_version === 'CONTRACT_PF_V1', 'template version mismatch')
  assert(metadata.original_file_size > 0 && metadata.original_mime_type === 'application/pdf', 'PDF metadata invalid')
  assert(/^[a-f0-9]{64}$/.test(metadata.original_sha256), 'PDF SHA invalid')
  assert(metadata.original_file_path && metadata.canonical_payload_hash && metadata.generated_at && metadata.generated_by && metadata.issued_at, 'document metadata incomplete')
  console.log(`generate: PASS HTTP=${generate.status}`)

  const repeat = await fetch(`${url}/functions/v1/generate-contract-document`, { method: 'POST', headers, body: JSON.stringify({ contract_id: contractId }) })
  const repeated = await repeat.json()
  assert(repeat.ok && repeated.idempotent === true && (repeated.document.document_id ?? repeated.document.id) === documentId && repeated.document.version === 1, 'idempotency failed')
  console.log(`idempotency: PASS HTTP=${repeat.status}`)

  const download = await fetch(`${url}/functions/v1/download-contract-document`, { method: 'POST', headers, body: JSON.stringify({ document_id: documentId }) })
  assert(download.ok, `download HTTP ${download.status}`)
  const downloadBody = await download.json()
  assert(downloadBody.expires_in === 300 && downloadBody.signed_url, 'signed URL response invalid')
  const pdf = await fetch(downloadBody.signed_url)
  const bytes = new Uint8Array(await pdf.arrayBuffer())
  assert(pdf.ok && (pdf.headers.get('content-type') ?? '').includes('application/pdf') && bytes.length > 0, 'downloaded PDF invalid')
  assert(createHash('sha256').update(bytes).digest('hex') === metadata.original_sha256, 'SHA cross-check failed')
  console.log(`download: PASS HTTP=${download.status}`)
  console.log('sha: PASS')

  const anonymous = await fetch(`${url}/functions/v1/download-contract-document`, { method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: documentId }) })
  assert(anonymous.status === 401, `anonymous access was HTTP ${anonymous.status}`)
  console.log('anonymous: PASS DENY')

  if (restrictedEmail && restrictedPassword) {
    const restricted = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const restrictedAuth = await restricted.auth.signInWithPassword({ email: restrictedEmail, password: restrictedPassword })
    assert(!restrictedAuth.error && restrictedAuth.data.session, 'restricted auth failed')
    const outsider = await fetch(`${url}/functions/v1/download-contract-document`, { method: 'POST', headers: { Authorization: `Bearer ${restrictedAuth.data.session.access_token}`, apikey: anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: documentId }) })
    assert(outsider.status === 404, `outsider access was HTTP ${outsider.status}`)
    console.log('restricted/outsider: PASS DENY')
  } else {
    console.log('restricted/outsider: SKIP credentials unavailable')
  }
} finally {
  const sales = await admin.from('sales').select('id, student_id, person_id').ilike('commercial_notes', `%${runId}%`)
  const saleIds = (sales.data ?? []).map((row) => row.id)
  const contracts = saleIds.length ? await admin.from('contracts').select('id').in('sale_id', saleIds) : { data: [] }
  const contractIds = (contracts.data ?? []).map((row) => row.id)
  let removedPaths = []
  if (contractIds.length) {
    const documents = await admin.from('contract_documents').select('id, original_file_path').in('contract_id', contractIds)
    const paths = (documents.data ?? []).flatMap((row) => row.original_file_path ? [row.original_file_path] : [])
    removedPaths = paths
    if (paths.length) {
      const removed = await admin.storage.from('contract-documents').remove(paths)
      assert(!removed.error, 'Storage cleanup failed')
    }
    const deletedDocuments = await admin.from('contract_documents').delete().in('contract_id', contractIds)
    const deletedContracts = await admin.from('contracts').delete().in('id', contractIds)
    assert(!deletedDocuments.error && !deletedContracts.error, 'Contract cleanup failed')
  }
  if (saleIds.length) assert(!(await admin.from('sales').delete().in('id', saleIds)).error, 'Sale cleanup failed')
  if (leadId) assert(!(await admin.from('crm_leads').delete().eq('id', leadId)).error, 'Lead cleanup failed')
  const studentIds = [...new Set((sales.data ?? []).map((row) => row.student_id).filter(Boolean))]
  if (studentIds.length) {
    const studentDelete = await admin.from('students').delete().in('id', studentIds)
    assert(!studentDelete.error, `Student cleanup failed: ${studentDelete.error?.code ?? 'db_error'}`)
  }
  if (personId) {
    const personDelete = await admin.from('people').delete().eq('id', personId)
    const relations = [...(personDelete.error?.message?.matchAll(/table "([^"]+)"/g) ?? [])].map((match) => match[1])
    const relation = relations.at(-1) ?? 'unknown_table'
    assert(!personDelete.error, `Person cleanup failed: ${personDelete.error?.code ?? 'db_error'} relation=${relation}`)
  }
  const remaining = await Promise.all([
    admin.from('crm_leads').select('id', { count: 'exact', head: true }).ilike('commercial_notes', `%${runId}%`),
    admin.from('sales').select('id', { count: 'exact', head: true }).ilike('commercial_notes', `%${runId}%`),
    admin.from('contracts').select('id', { count: 'exact', head: true }).ilike('contract_notes', `%${runId}%`)
  ])
  assert(remaining.every((result) => !result.error && (result.count ?? 0) === 0), 'QA DB residue detected')
  if (removedPaths.length) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    const storageResidue = await admin.from('storage.objects').select('name', { count: 'exact', head: true }).eq('bucket_id', 'contract-documents').in('name', removedPaths)
    assert(!storageResidue.error && (storageResidue.count ?? 0) === 0, 'QA Storage residue detected')
  }
  console.log('cleanup: PASS DB=0 STORAGE=0')
}
