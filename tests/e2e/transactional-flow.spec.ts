import { expect, test } from '@playwright/test'
import { cleanupE2eRun, createEnrollmentFixture } from './enrollment-fixture'
import { hasAdminCredentials } from './helpers'

test.describe('12C5 — Lead → Venda → Contrato → Aluno (ADMIN)', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('cria e conclui o fluxo transacional pela UI', async ({ page }) => {
    test.setTimeout(90_000)
    const runId = `E2E-ENR-${Date.now()}`
    try {
      const fixture = await createEnrollmentFixture(page, runId)
      await expect(page).toHaveURL(/\/matriculas\/[^/]+$/)
      await expect(page.getByRole('heading', { name: fixture.enrollmentCode, exact: true })).toBeVisible()
      await expect(page.getByText('Pendente', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Ativar matrícula' }).click()
      await page.getByRole('button', { name: 'Ativar matrícula', exact: true }).last().click()
      await expect(page.getByText('Ativa', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Pausar matrícula' }).click()
      const pauseDialog = page.getByRole('dialog', { name: 'Pausar matrícula' })
      await pauseDialog.getByLabel('Motivo *').fill(runId)
      await pauseDialog.getByRole('button', { name: 'Pausar matrícula', exact: true }).click()
      await expect(page.getByText('Pausada', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Retomar matrícula' }).click()
      await page.getByRole('button', { name: 'Retomar matrícula', exact: true }).last().click()
      await expect(page.getByText('Ativa', { exact: true })).toBeVisible()

      await page.getByRole('button', { name: 'Concluir matrícula' }).click()
      await page.getByRole('button', { name: 'Concluir matrícula', exact: true }).last().click()
      await expect(page.getByText('Concluída', { exact: true })).toBeVisible()
    } finally {
      await cleanupE2eRun(runId)
    }
  })
})
