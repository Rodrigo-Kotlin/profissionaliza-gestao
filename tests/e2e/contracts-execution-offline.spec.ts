import { expect, test } from '@playwright/test'
import { OFFLINE_MESSAGE } from '../../src/lib/offline'
import {
  cleanupE2eRun,
  createEnrollmentFixture,
  inspectExecutionRun
} from './enrollment-fixture'
import { hasAdminCredentials } from './helpers'

const hasOfflinePrerequisites = Boolean(
  process.env.E2E_BASE_URL && process.env.E2E_EMAIL && process.env.E2E_PASSWORD && process.env.E2E_SECRET_KEY
)

test.describe('@local-destructive 2.6B3 — mutations de execução offline autenticadas', () => {
  test.skip(!hasOfflinePrerequisites, 'E2E_BASE_URL, E2E_EMAIL, E2E_PASSWORD e E2E_SECRET_KEY são obrigatórios.')
  test.skip(!hasAdminCredentials, 'Credenciais ADMIN QA ausentes.')

  test('upload offline falha localmente e retry manual produz um único objeto', async ({ page, context }, testInfo) => {
    test.setTimeout(180_000)
    const runId = `E2E-B3-OFFLINE-UPLOAD-${Date.now()}`
    const requests: string[] = []
    const pageErrors: Error[] = []
    const consoleErrors: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('upload-contract-execution')) requests.push(request.url())
    })
    page.on('pageerror', (error) => pageErrors.push(error))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    try {
      await createEnrollmentFixture(page, runId, { method: 'GOV_BR', stopAt: 'PENDING_UPLOAD' })
      const initial = await inspectExecutionRun(runId)
      expect(initial.executionStatus).toBe('PENDING_UPLOAD')
      expect(initial.storageExists).toBe(false)
      expect(await page.evaluate(() => navigator.onLine)).toBe(true)

      await context.setOffline(true)
      expect(await page.evaluate(() => navigator.onLine)).toBe(false)
      const startedAt = Date.now()
      await page.getByLabel('PDF assinado').setInputFiles({ name: 'qa-offline-upload.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') })
      await page.getByRole('button', { name: 'Enviar PDF' }).click()
      await expect(page.getByText(OFFLINE_MESSAGE)).toBeVisible({ timeout: 5_000 })
      const feedbackMs = Date.now() - startedAt
      console.log(`EXPECTED_OFFLINE upload feedback_ms=${feedbackMs}`)
      testInfo.annotations.push({ type: 'offline-feedback-ms', description: `upload=${feedbackMs}` })
      expect(feedbackMs).toBeLessThan(5_000)
      await expect(page.getByRole('button', { name: 'Enviar PDF' })).toBeEnabled()
      expect(requests).toHaveLength(0)

      const offlineState = await inspectExecutionRun(runId)
      expect(offlineState.executionStatus).toBe('PENDING_UPLOAD')
      expect(offlineState.storageExists).toBe(false)

      await context.setOffline(false)
      expect(await page.evaluate(() => navigator.onLine)).toBe(true)
      await page.waitForTimeout(2_000)
      expect(requests).toHaveLength(0)
      await page.getByRole('button', { name: 'Enviar PDF' }).click()
      await expect(page.getByText('Recebido, aguardando conferência')).toBeVisible({ timeout: 15_000 })
      expect(requests).toHaveLength(1)
      const finalState = await inspectExecutionRun(runId)
      expect(finalState.executionStatus).toBe('RECEIVED')
      expect(finalState.storageExists).toBe(true)
      expect(pageErrors).toHaveLength(0)
      expect(unexpectedConsoleErrors(consoleErrors)).toEqual([])
    } finally {
      await context.setOffline(false)
      await cleanupE2eRun(runId)
    }
  })

  test('verify offline falha localmente e retry manual conclui uma única vez', async ({ page, context }, testInfo) => {
    test.setTimeout(180_000)
    const runId = `E2E-B3-OFFLINE-VERIFY-${Date.now()}`
    const requests: string[] = []
    const pageErrors: Error[] = []
    const consoleErrors: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('verify_contract_execution')) requests.push(request.url())
    })
    page.on('pageerror', (error) => pageErrors.push(error))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    try {
      await createEnrollmentFixture(page, runId, { method: 'GOV_BR', stopAt: 'RECEIVED' })
      const initial = await inspectExecutionRun(runId)
      expect(initial.executionStatus).toBe('RECEIVED')
      expect(initial.contractStatus).toBe('PENDING_SIGNATURE')
      expect(initial.enrollmentCount).toBe(0)

      await context.setOffline(true)
      const startedAt = Date.now()
      await page.getByRole('button', { name: 'Confirmar conferência' }).click()
      await expect(page.getByText(OFFLINE_MESSAGE)).toBeVisible({ timeout: 5_000 })
      const feedbackMs = Date.now() - startedAt
      console.log(`EXPECTED_OFFLINE verify feedback_ms=${feedbackMs}`)
      testInfo.annotations.push({ type: 'offline-feedback-ms', description: `verify=${feedbackMs}` })
      expect(feedbackMs).toBeLessThan(5_000)
      await expect(page.getByRole('button', { name: 'Confirmar conferência' })).toBeEnabled()
      expect(requests).toHaveLength(0)
      const offlineState = await inspectExecutionRun(runId)
      expect(offlineState.executionStatus).toBe('RECEIVED')
      expect(offlineState.contractStatus).toBe('PENDING_SIGNATURE')
      expect(offlineState.enrollmentCount).toBe(0)

      await context.setOffline(false)
      await page.waitForTimeout(2_000)
      expect(requests).toHaveLength(0)
      await page.getByRole('button', { name: 'Confirmar conferência' }).click()
      await expect(page.getByText('Conferido', { exact: true })).toBeVisible({ timeout: 15_000 })
      expect(requests).toHaveLength(1)
      await page.getByRole('button', { name: 'Concluir contrato' }).click()
      await expect(page.getByRole('button', { name: 'Ver matrícula' })).toBeVisible({ timeout: 15_000 })
      const finalState = await inspectExecutionRun(runId)
      expect(finalState.executionStatus).toBe('VERIFIED')
      expect(finalState.contractStatus).toBe('SIGNED')
      expect(finalState.enrollmentCount).toBe(1)
      expect(pageErrors).toHaveLength(0)
      expect(unexpectedConsoleErrors(consoleErrors)).toEqual([])
    } finally {
      await context.setOffline(false)
      await cleanupE2eRun(runId)
    }
  })

  test('reject offline falha localmente e retry manual rejeita uma única vez', async ({ page, context }, testInfo) => {
    test.setTimeout(180_000)
    const runId = `E2E-B3-OFFLINE-REJECT-${Date.now()}`
    const requests: string[] = []
    const pageErrors: Error[] = []
    const consoleErrors: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('reject_contract_execution')) requests.push(request.url())
    })
    page.on('pageerror', (error) => pageErrors.push(error))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    try {
      await createEnrollmentFixture(page, runId, { method: 'GOV_BR', stopAt: 'RECEIVED' })
      const initial = await inspectExecutionRun(runId)
      expect(initial.executionStatus).toBe('RECEIVED')
      await page.getByPlaceholder('Motivo obrigatório da rejeição').fill(`${runId} rejection`)

      await context.setOffline(true)
      const startedAt = Date.now()
      await page.getByRole('button', { name: 'Rejeitar' }).click()
      await expect(page.getByText(OFFLINE_MESSAGE)).toBeVisible({ timeout: 5_000 })
      const feedbackMs = Date.now() - startedAt
      console.log(`EXPECTED_OFFLINE reject feedback_ms=${feedbackMs}`)
      testInfo.annotations.push({ type: 'offline-feedback-ms', description: `reject=${feedbackMs}` })
      expect(feedbackMs).toBeLessThan(5_000)
      await expect(page.getByRole('button', { name: 'Rejeitar' })).toBeEnabled()
      expect(requests).toHaveLength(0)
      const offlineState = await inspectExecutionRun(runId)
      expect(offlineState.executionStatus).toBe('RECEIVED')
      expect(offlineState.rejectionReason).toBeNull()

      await context.setOffline(false)
      await page.waitForTimeout(2_000)
      expect(requests).toHaveLength(0)
      await page.getByRole('button', { name: 'Rejeitar' }).click()
      await expect(page.getByText('Rejeitado', { exact: true })).toBeVisible({ timeout: 15_000 })
      expect(requests).toHaveLength(1)
      const finalState = await inspectExecutionRun(runId)
      expect(finalState.executionStatus).toBe('REJECTED')
      expect(finalState.rejectionReason).toContain(runId)
      expect(pageErrors).toHaveLength(0)
      expect(unexpectedConsoleErrors(consoleErrors)).toEqual([])
    } finally {
      await context.setOffline(false)
      await cleanupE2eRun(runId)
    }
  })
})

function unexpectedConsoleErrors(messages: string[]) {
  return messages.filter((message) => !/network|fetch|offline|failed to fetch|load failed/i.test(message))
}
