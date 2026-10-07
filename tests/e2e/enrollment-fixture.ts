import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import { e2eEnv, login } from './helpers'

export type EnrollmentFixture = {
  runId: string
  studentName: string
  leadCode: string
  saleCode: string
  studentCode: string
  contractCode: string
  enrollmentCode: string
}

export async function createEnrollmentFixture(page: Page, runId: string): Promise<EnrollmentFixture> {
  const leadName = `QA ${runId}`
  const email = `qa+${runId.toLowerCase()}@profissionaliza.test`
  const phone = `119${runId.replace(/\D/g, '').slice(-8)}`

  await login(page, e2eEnv.email, e2eEnv.password)
  await page.goto('/crm/leads')
  await page.getByRole('button', { name: 'Novo Lead' }).click()

  const leadDrawer = page.getByRole('dialog', { name: 'Novo Lead' })
  await leadDrawer.getByLabel('Nome completo *').fill(leadName)
  await leadDrawer.getByLabel('Telefone').fill(phone)
  await leadDrawer.getByLabel('WhatsApp').fill(phone)
  await leadDrawer.getByLabel('E-mail').fill(email)
  await leadDrawer.locator('select[name="source_code"]').selectOption('SITE')
  await leadDrawer.locator('select[name="course_interest_id"]').selectOption({ index: 1 })
  await leadDrawer.locator('select[name="stage_id"]').selectOption({ label: 'Negociação' })
  await leadDrawer.locator('textarea').last().fill(runId)
  await leadDrawer.getByRole('button', { name: 'Criar lead', exact: true }).click()

  await page.getByRole('heading', { name: leadName }).waitFor()
  const leadCode = (await page.getByText(/^LEAD-\d{4}-\d{6}$/).first().textContent()) ?? ''
  await page.getByRole('button', { name: 'Fechar venda' }).click()

  const saleDialog = page.getByRole('dialog', { name: 'Fechar venda' })
  await saleDialog.locator('select').nth(0).selectOption({ index: 1 })
  await saleDialog.getByLabel('Valor bruto *').fill('1390')
  await saleDialog.getByLabel('Desconto').fill('0')
  await saleDialog.getByLabel('Parcelas *').fill('1')
  await saleDialog.locator('textarea').fill(runId)
  await saleDialog.getByRole('button', { name: 'Revisar venda' }).click()
  await saleDialog.getByRole('button', { name: 'Confirmar venda' }).click()

  await page.waitForURL(/\/vendas\/[^/]+$/)
  const saleCode = (await page.getByText(/^VND-\d{4}-\d{6}$/).first().textContent()) ?? ''
  const studentCode = (await page.getByText(/^ALU-\d{4}-\d{6}$/).first().textContent()) ?? ''
  await completeQaPerson(email, runId)
  await page.reload()
  await page.waitForURL(/\/vendas\/[^/]+$/)
  await page.getByRole('button', { name: 'Gerar contrato' }).click()

  const contractDialog = page.getByRole('dialog', { name: 'Gerar contrato' })
  const completeContractorButton = contractDialog.getByRole('button', { name: 'Salvar dados do contratante' })
  if (await completeContractorButton.isVisible()) {
    await contractDialog.getByLabel('CEP *').fill('01001000')
    await contractDialog.getByLabel('Logradouro *').fill('Rua QA E2E')
    await contractDialog.getByLabel('Número *').fill('100')
    await contractDialog.getByLabel('Bairro *').fill('Centro')
    await contractDialog.getByLabel('Cidade *').fill('São Paulo')
    await contractDialog.getByLabel('UF *').fill('SP')
    await completeContractorButton.click()
  }
  await expect(contractDialog.getByText('Dados do contratante completos')).toBeVisible()
  await expect(contractDialog.getByRole('button', { name: 'Trocar' })).toBeVisible()
  const reviewContractButton = contractDialog.getByRole('button', { name: 'Revisar contrato' })
  const createContractButton = contractDialog.getByRole('button', { name: 'Criar contrato em rascunho' })
  await expect(reviewContractButton).toBeEnabled()
  await reviewContractButton.click()
  await expect(createContractButton).toBeVisible()
  await expect(contractDialog.getByText(studentCode, { exact: true })).toBeVisible()
  await contractDialog.locator('textarea').fill(runId)
  await createContractButton.click()
  await expect(contractDialog.getByText('Contrato criado')).toBeVisible()
  const contractCode = (await page.getByText(/^CTR-\d{4}-\d{6}$/).first().textContent()) ?? ''
  const viewContractButton = contractDialog.getByRole('button', { name: 'Ver contrato', exact: true })
  await expect(viewContractButton).toBeVisible()
  await expect(viewContractButton).toBeEnabled()
  await viewContractButton.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/contratos\/[^/]+$/)

  await page.getByRole('button', { name: 'Emitir contrato' }).click()
  const issueDialog = page.getByRole('dialog', { name: new RegExp(`Emitir ${contractCode}`) })
  await issueDialog.getByRole('button', { name: 'Confirmar emissão' }).click()
  await page.getByRole('button', { name: 'Registrar assinatura' }).click()
  const signDialog = page.getByRole('dialog', { name: new RegExp(`Assinar ${contractCode}`) })
  await signDialog.getByRole('button', { name: 'Confirmar assinatura' }).click()
  await page.getByRole('button', { name: 'Ver matrícula' }).click()

  await page.waitForURL(/\/matriculas\/[^/]+$/)
  const enrollmentCode = (await page.getByText(/^MAT-\d{4}-\d{6}$/).first().textContent()) ?? ''
  return { runId, studentName: leadName, leadCode, saleCode, studentCode, contractCode, enrollmentCode }
}

async function completeQaPerson(email: string, runId: string) {
  const url = process.env.VITE_SUPABASE_URL
  const secretKey = process.env.E2E_SECRET_KEY
  if (!url || !secretKey) throw new Error('E2E_SECRET_KEY é obrigatório para preparar a fixture.')
  const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const result = await client.from('people').update({
    cpf: runId.replace(/\D/g, '').slice(-11).padStart(11, '1'),
    postal_code: '01001000',
    street: 'Rua QA E2E',
    number: '100',
    district: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    country: 'Brasil'
  }).eq('email', email)
  if (result.error) throw result.error
}

export async function cleanupE2eRun(runId: string) {
  const url = process.env.VITE_SUPABASE_URL
  const secretKey = process.env.E2E_SECRET_KEY
  if (!url || !secretKey) throw new Error('E2E_SECRET_KEY é obrigatório para cleanup determinístico.')

  const client = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const [leadsResult, salesResult] = await Promise.all([
    client.from('crm_leads').select('id, person_id').ilike('commercial_notes', `%${runId}%`),
    client.from('sales').select('id, student_id, person_id').ilike('commercial_notes', `%${runId}%`)
  ])
  if (leadsResult.error) throw leadsResult.error
  if (salesResult.error) throw salesResult.error

  const leadIds = leadsResult.data.map((row) => row.id)
  const saleIds = salesResult.data.map((row) => row.id)
  const contractsResult = saleIds.length
    ? await client.from('contracts').select('id').in('sale_id', saleIds)
    : await client.from('contracts').select('id').ilike('contract_notes', `%${runId}%`)
  if (contractsResult.error) throw contractsResult.error
  const contractIds = contractsResult.data.map((row) => row.id)
  const studentIds = salesResult.data.map((row) => row.student_id)
  const personIds = [...new Set([...leadsResult.data.map((row) => row.person_id), ...salesResult.data.map((row) => row.person_id)])]

  if (contractIds.length) {
    const result = await client.from('enrollments').delete().in('contract_id', contractIds)
    if (result.error) throw result.error
    const resultContracts = await client.from('contracts').delete().in('id', contractIds)
    if (resultContracts.error) throw resultContracts.error
  }
  if (saleIds.length) {
    const result = await client.from('enrollments').delete().in('sale_id', saleIds)
    if (result.error) throw result.error
    const resultSales = await client.from('sales').delete().in('id', saleIds)
    if (resultSales.error) throw resultSales.error
  }
  if (leadIds.length) {
    const result = await client.from('crm_leads').delete().in('id', leadIds)
    if (result.error) throw result.error
  }
  if (studentIds.length) {
    const result = await client.from('students').delete().in('id', studentIds)
    if (result.error) throw result.error
  }
  if (personIds.length) {
    const result = await client.from('people').delete().in('id', personIds)
    if (result.error) throw result.error
  }

  const [remainingLeads, remainingSales, remainingContracts] = await Promise.all([
    client.from('crm_leads').select('id', { count: 'exact', head: true }).ilike('commercial_notes', `%${runId}%`),
    client.from('sales').select('id', { count: 'exact', head: true }).ilike('commercial_notes', `%${runId}%`),
    client.from('contracts').select('id', { count: 'exact', head: true }).ilike('contract_notes', `%${runId}%`)
  ])
  if (remainingLeads.error) throw remainingLeads.error
  if (remainingSales.error) throw remainingSales.error
  if (remainingContracts.error) throw remainingContracts.error
  if ((remainingLeads.count ?? 0) + (remainingSales.count ?? 0) + (remainingContracts.count ?? 0) !== 0) {
    throw new Error(`Resíduos encontrados para ${runId}.`)
  }
}
