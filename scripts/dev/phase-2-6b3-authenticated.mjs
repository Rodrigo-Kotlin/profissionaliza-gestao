/* global Blob, FormData, TextEncoder, fetch, process, console */

import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.B3_SUPABASE_URL
const anonKey = process.env.B3_ANON_KEY
const secretKey = process.env.E2E_SECRET_KEY
if (!url || !anonKey || !secretKey) throw new Error('B3 runtime configuration is incomplete')
const runId = process.env.B3_RUN_ID?.trim()
if (!runId || !/^[a-z0-9_-]+$/i.test(runId)) throw new Error('B3_RUN_ID is required and must be deterministic')

const admin = createClient(url, secretKey, { auth: { persistSession: false } })
const qaEmail = (role) => `qa-b3-${role}@profissionaliza.test`
const passwords = new Map()
const fixtures = []
const stageIds = [
  '37ffa2c8-5d9e-4056-a706-38c735eed978',
  '13dd8725-a87c-43dd-97df-08e9caacb760',
  '9a3e286f-26d3-4ceb-9d28-221a3ee45f43',
  '88071e38-3ac6-4a39-9b14-bffce9b2ed9d'
]
const courseId = '7620f127-7dc5-4efd-90a5-b57c3a64c624'

function fail(message) { throw new Error(message) }
function expect(condition, message) { if (!condition) fail(message) }
function password() { return `B3-${randomBytes(24).toString('base64url')}-Qa!` }
function isoDate(daysAgo = 1) {
  const date = new Date(Date.now() - daysAgo * 86400000)
  return date.toISOString()
}
function fixturePhone(tag) {
  const value = Number.parseInt(createHash('sha256').update(`${runId}:${tag}`).digest('hex').slice(0, 8), 16) % 1_000_000_000
  return `11${String(value).padStart(9, '0')}`
}
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error) fail(`${name}: ${error.message}`)
  return data
}
async function invoke(client, name, options) {
  const { data, error } = await client.functions.invoke(name, options)
  if (error) {
    const status = error.context?.status ?? 'unknown'
    fail(`${name}: HTTP ${status}`)
  }
  return data
}
async function expectedError(action, expectedText) {
  try {
    await action()
    fail(`Expected error was not raised: ${expectedText}`)
  } catch (error) {
    const message = String(error?.message ?? error)
    if (expectedText) expect(message.toLowerCase().includes(expectedText.toLowerCase()), `Unexpected error for ${expectedText}: ${message}`)
  }
}
async function getUserByEmail(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) fail(`listUsers: ${error.message}`)
    const found = data.users.find((user) => user.email === email)
    if (found) return found
    if (data.users.length < 1000) return null
  }
  return null
}
async function provision(role, fullName) {
  const email = qaEmail(role.toLowerCase())
  const nextPassword = password()
  let user = await getUserByEmail(email)
  if (user) {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password: nextPassword,
      email_confirm: true,
      user_metadata: { qa_role: role, full_name: fullName }
    })
    if (error) fail(`updateUserById: ${error.message}`)
    user = data.user
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: nextPassword,
      email_confirm: true,
      user_metadata: { qa_role: role, full_name: fullName }
    })
    if (error) fail(`createUser: ${error.message}`)
    user = data.user
  }
  const { error: profileError } = await admin.from('profiles').upsert({
    id: user.id, email, full_name: fullName, is_active: true
  })
  if (profileError) fail(`profile: ${profileError.message}`)
  const { data: roleRow, error: roleError } = await admin.from('roles').select('id').eq('code', role).single()
  if (roleError) fail(`role lookup: ${roleError.message}`)
  const { error: clearError } = await admin.from('user_roles').delete().eq('user_id', user.id)
  if (clearError) fail(`role cleanup: ${clearError.message}`)
  const { error: grantError } = await admin.from('user_roles').insert({ user_id: user.id, role_id: roleRow.id })
  if (grantError) fail(`role grant: ${grantError.message}`)
  passwords.set(role, { email, password: nextPassword, id: user.id })
  return user
}
async function login(role) {
  const credentials = passwords.get(role)
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword(credentials)
  if (error || !data.session) fail(`signInWithPassword ${role}: ${error?.message ?? 'no session'}`)
  return client
}
async function prepareContract(client, tag, ownerClient = client) {
  const marker = `E2E-B3-${runId}-${tag}`
  const phone = fixturePhone(tag)
  const leadId = await rpc(ownerClient, 'create_crm_lead', {
    p_full_name: `QA B3 ${tag}`,
    p_phone: phone, p_whatsapp: phone,
    p_email: `qa-${runId}-${tag.toLowerCase()}@profissionaliza.test`,
    p_source_code: 'SITE', p_course_interest_id: courseId,
    p_temperature: 'HOT', p_commercial_notes: marker, p_force_create: false
  })
  for (const stageId of stageIds) await rpc(ownerClient, 'move_crm_lead_stage', { p_lead_id: leadId, p_new_stage_id: stageId, p_reason: marker })
  const leadDetail = await rpc(ownerClient, 'get_crm_lead_detail', { p_lead_id: leadId })
  const sale = await rpc(ownerClient, 'create_sale_from_lead', {
    p_lead_id: leadId, p_course_id: courseId, p_gross_value: 1390,
    p_payment_method: 'PIX', p_discount_value: 0, p_installments: 1,
    p_commercial_notes: marker
  })
  const saleId = sale.sale_id
  const saleDetail = await rpc(ownerClient, 'get_sale_detail', { p_sale_id: saleId })
  const contract = await rpc(client, 'create_contract_from_sale', {
    p_sale_id: saleId, p_contractor_person_id: leadDetail.person_id, p_contract_notes: marker
  })
  const contractId = contract.contract_id
  await invoke(client, 'generate-contract-document', { body: { contract_id: contractId } })
  const documents = await rpc(client, 'list_contract_documents', { p_contract_id: contractId })
  const document = documents.data.find((item) => item.status === 'FINAL')
  expect(document, `${tag}: final document missing`)
  await rpc(client, 'issue_contract', { p_contract_id: contractId })
  const fixture = { tag, marker, leadId, personId: leadDetail.person_id, saleId, studentId: saleDetail.student_id, contractId, documentId: document.document_id, document, executionIds: [] }
  fixtures.push(fixture)
  return fixture
}
async function createExecution(client, fixture, method) {
  const detail = await rpc(client, 'get_contract_detail', { p_contract_id: fixture.contractId })
  const execution = await rpc(client, 'create_contract_execution', {
    p_contract_document_id: fixture.documentId,
    p_execution_method: method,
    p_signer_person_id: detail.contractor_person_id,
    p_signer_name_snapshot: detail.contractor_name,
    p_signed_at: isoDate()
  })
  fixture.executionIds.push(execution.execution_id)
  return execution.execution_id
}
function pdfFixture() {
  return new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
}
async function upload(client, executionId, bytes, type = 'application/pdf', name = 'signed.pdf') {
  const form = new FormData()
  form.append('execution_id', executionId)
  form.append('file', new Blob([bytes], { type }), name)
  form.append('signed_at', isoDate())
  return invoke(client, 'upload-contract-execution', { body: form })
}
async function downloadHash(client, executionId) {
  const result = await invoke(client, 'download-contract-execution', { body: { execution_id: executionId } })
  const response = await fetch(result.signed_url)
  expect(response.ok, 'signed URL download failed')
  const bytes = new Uint8Array(await response.arrayBuffer())
  return createHash('sha256').update(bytes).digest('hex')
}
async function verify(client, executionId, method) {
  return rpc(client, 'verify_contract_execution', {
    p_execution_id: executionId,
    p_verification_method: method,
    p_verification_notes: 'QA B3 manual verification',
    p_signed_at: isoDate(),
    p_evidence_json: { verification_source: method === 'GOV_BR_VALIDAR_MANUAL' ? 'VALIDAR_ITI' : 'IN_PERSON', verification_result: 'VALID' }
  })
}
async function complete(client, executionId) {
  return rpc(client, 'complete_contract_from_verified_execution', { p_execution_id: executionId })
}
async function assertContractAndEnrollment(client, fixture) {
  const contract = await rpc(client, 'get_contract_detail', { p_contract_id: fixture.contractId })
  expect(contract.status === 'SIGNED', `${fixture.tag}: contract not SIGNED`)
  expect(contract.enrollment_id, `${fixture.tag}: enrollment missing`)
  const enrollmentDetail = await rpc(client, 'get_enrollment_detail', { p_enrollment_id: contract.enrollment_id })
  const enrollment = enrollmentDetail.enrollment
  expect(enrollment.status === 'PENDING', `${fixture.tag}: enrollment not PENDING`)
  expect(enrollment.contract_id === fixture.contractId, `${fixture.tag}: enrollment contract mismatch`)
  expect(enrollment.sale_id === fixture.saleId, `${fixture.tag}: enrollment sale mismatch`)
  expect(enrollment.student_id === fixture.studentId, `${fixture.tag}: enrollment student mismatch`)
  expect(enrollment.course_id === courseId, `${fixture.tag}: enrollment course mismatch`)
  return { contract, enrollment }
}
async function invalidPdfChecks(client, fixture, executionId) {
  await expectedError(() => upload(client, executionId, new TextEncoder().encode('not pdf'), 'text/plain', 'invalid.txt'), 'HTTP')
  await expectedError(() => upload(client, executionId, new TextEncoder().encode('not pdf'), 'application/pdf'), 'HTTP')
  await expectedError(() => upload(client, executionId, new Uint8Array(), 'application/pdf'), 'HTTP')
  const valid = pdfFixture()
  await upload(client, executionId, valid)
  await expectedError(() => upload(client, executionId, valid), 'HTTP')
}
async function auditCheck(ids) {
  const { data, error } = await admin.from('audit_logs').select('action,entity_id').in('entity_id', ids)
  if (error) fail(`audit query: ${error.message}`)
  const actions = new Set(data.map((row) => row.action))
  for (const action of ['contract.execution_created', 'contract.execution_received', 'contract.execution_rejected', 'contract.execution_verified', 'contracts.signed', 'enrollment.created']) {
    expect(actions.has(action), `audit action missing: ${action}`)
  }
}
async function cleanup() {
  const ids = fixtures.flatMap((fixture) => [fixture.contractId, fixture.saleId, fixture.leadId, fixture.studentId, ...fixture.executionIds])
  const enrollmentIds = []
  for (const fixture of fixtures) {
    const { data } = await admin.from('enrollments').select('id').eq('contract_id', fixture.contractId)
    enrollmentIds.push(...(data ?? []).map((row) => row.id))
  }
  const storagePaths = fixtures.flatMap((fixture) => [
    `contracts/${fixture.contractId}/v${fixture.document.version}/original.pdf`,
    ...fixture.executionIds.map((id) => `contracts/${fixture.contractId}/v${fixture.document.version}/executions/${id}/signed.pdf`)
  ])
  if (storagePaths.length) {
    const { error } = await admin.storage.from('contract-documents').remove(storagePaths)
    if (error) fail(`cleanup storage: ${error.message}`)
  }
  async function remove(table, column, values) {
    if (!values.length) return
    const { error } = await admin.from(table).delete().in(column, values)
    if (error) fail(`cleanup ${table}: ${error.message}`)
  }
  await remove('enrollments', 'id', enrollmentIds)
  await remove('contract_executions', 'id', fixtures.flatMap((fixture) => fixture.executionIds))
  await remove('contract_documents', 'contract_id', fixtures.map((fixture) => fixture.contractId))
  await remove('contracts', 'id', fixtures.map((fixture) => fixture.contractId))
  await remove('sales', 'id', fixtures.map((fixture) => fixture.saleId))
  await remove('crm_leads', 'id', fixtures.map((fixture) => fixture.leadId))
  await remove('students', 'id', fixtures.map((fixture) => fixture.studentId))
  const people = fixtures.map((fixture) => fixture.personId)
  await remove('people', 'id', people)
  await remove('audit_logs', 'entity_id', ids.concat(enrollmentIds, people))
}

let adminClient
try {
  await provision('ADMIN', 'QA B3 Admin')
  await provision('VENDEDOR', 'QA B3 Seller')
  adminClient = await login('ADMIN')
  const sellerClient = await login('VENDEDOR')

  const gov = await prepareContract(adminClient, 'GOV')
  const govExecution = await createExecution(adminClient, gov, 'GOV_BR')
  const bytes = pdfFixture()
  await invalidPdfChecks(adminClient, gov, govExecution)
  const received = await rpc(adminClient, 'get_contract_execution_detail', { p_execution_id: govExecution })
  expect(received.status === 'RECEIVED', 'GOV execution not RECEIVED')
  expect(received.signed_file_size > 0 && received.signed_mime_type === 'application/pdf' && /^[0-9a-f]{64}$/.test(received.signed_sha256), 'GOV file metadata incomplete')
  expect(await downloadHash(adminClient, govExecution) === received.signed_sha256, 'GOV SHA-256 mismatch')
  await verify(adminClient, govExecution, 'GOV_BR_VALIDAR_MANUAL')
  await complete(adminClient, govExecution)
  await complete(adminClient, govExecution)
  const govResult = await assertContractAndEnrollment(adminClient, gov)

  const physical = await prepareContract(adminClient, 'PHYSICAL')
  const physicalExecution = await createExecution(adminClient, physical, 'PHYSICAL')
  await upload(adminClient, physicalExecution, bytes)
  await verify(adminClient, physicalExecution, 'PHYSICAL_IN_PERSON')
  await complete(adminClient, physicalExecution)
  const physicalResult = await assertContractAndEnrollment(adminClient, physical)

  const retry = await prepareContract(adminClient, 'RETRY')
  const rejectedExecution = await createExecution(adminClient, retry, 'PHYSICAL')
  await upload(adminClient, rejectedExecution, bytes)
  await rpc(adminClient, 'reject_contract_execution', { p_execution_id: rejectedExecution, p_rejection_reason: 'QA B3 rejection test' })
  const retryExecution = await createExecution(adminClient, retry, 'PHYSICAL')
  expect(retryExecution !== rejectedExecution, 'retry reused rejected execution')
  await upload(adminClient, retryExecution, bytes)
  await verify(adminClient, retryExecution, 'PHYSICAL_IN_PERSON')
  await complete(adminClient, retryExecution)
  const retryResult = await assertContractAndEnrollment(adminClient, retry)
  await expectedError(() => rpc(adminClient, 'mark_contract_signed', { p_contract_id: retry.contractId }), 'requires a VERIFIED execution')

  const canceled = await prepareContract(adminClient, 'CANCELED')
  await rpc(adminClient, 'cancel_contract', { p_contract_id: canceled.contractId, p_reason: 'QA B3 cancellation test' })
  await expectedError(() => createExecution(adminClient, canceled, 'GOV_BR'), 'Canceled contracts cannot be formalized')

  const sellerOwned = await prepareContract(adminClient, 'SELLER', sellerClient)
  const outsiderExecution = govExecution
  await expectedError(() => rpc(sellerClient, 'verify_contract_execution', { p_execution_id: outsiderExecution, p_verification_method: 'GOV_BR_VALIDAR_MANUAL', p_signed_at: isoDate() }), 'permission')
  await expectedError(() => complete(sellerClient, outsiderExecution), 'permission')
  await expectedError(() => invoke(sellerClient, 'download-contract-execution', { body: { execution_id: govExecution } }), '404')
  await expectedError(() => rpc(adminClient, 'mark_contract_signed', { p_contract_id: sellerOwned.contractId }), 'requires a VERIFIED execution')

  const auditIds = [gov.contractId, physical.contractId, retry.contractId, govExecution, physicalExecution, rejectedExecution, retryExecution, govResult.enrollment.enrollment_id ?? govResult.enrollment.id, physicalResult.enrollment.enrollment_id ?? physicalResult.enrollment.id, retryResult.enrollment.enrollment_id ?? retryResult.enrollment.id]
  await auditCheck(auditIds)
  console.log(JSON.stringify({ status: 'PASS', gov: 'PASS', physical: 'PASS', rejection_retry: 'PASS', idempotency: 'PASS', seller_scope: 'PASS', canceled: 'PASS', audit: 'PASS' }))
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', message: String(error?.message ?? error) }))
  process.exitCode = 1
} finally {
  try { await cleanup() } catch (error) { console.error(JSON.stringify({ cleanup: 'FAIL', message: String(error?.message ?? error) })); process.exitCode = 1 }
}
