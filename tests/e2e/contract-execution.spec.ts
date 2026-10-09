import { expect, test } from '@playwright/test'
import { cleanupE2eRun, createEnrollmentFixture } from './enrollment-fixture'
import { hasAdminCredentials } from './helpers'

test.describe('2.6B3 — formalização de execução contratual', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('PHYSICAL conclui contrato e cria matrícula pendente', async ({ page }) => {
    test.setTimeout(120_000)
    const runId = `E2E-B3-UI-PHYSICAL-${Date.now()}`
    try {
      const fixture = await createEnrollmentFixture(page, runId, { method: 'PHYSICAL' })
      await expect(page.getByRole('heading', { name: fixture.enrollmentCode, exact: true })).toBeVisible()
      await expect(page.getByText('Pendente', { exact: true })).toBeVisible()
    } finally {
      await cleanupE2eRun(runId)
    }
  })

  test('rejeição preserva histórico e permite retry', async ({ page }) => {
    test.setTimeout(120_000)
    const runId = `E2E-B3-UI-RETRY-${Date.now()}`
    try {
      const fixture = await createEnrollmentFixture(page, runId, { method: 'GOV_BR', rejectOnce: true })
      await expect(page.getByRole('heading', { name: fixture.enrollmentCode, exact: true })).toBeVisible()
      await expect(page.getByText('Pendente', { exact: true })).toBeVisible()
    } finally {
      await cleanupE2eRun(runId)
    }
  })
})
