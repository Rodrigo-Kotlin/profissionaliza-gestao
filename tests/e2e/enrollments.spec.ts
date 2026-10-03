import { expect, test } from '@playwright/test'
import { cleanupE2eRun, createEnrollmentFixture } from './enrollment-fixture'
import { hasAdminCredentials } from './helpers'

test.describe('Matrículas — navegação autenticada', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('ADMIN cria, lista e abre o detalhe em mobile e desktop', async ({ page }) => {
    test.setTimeout(90_000)
    const runId = `E2E-ENR-${Date.now()}`
    try {
      const fixture = await createEnrollmentFixture(page, runId)
      for (const viewport of [
        { width: 320, height: 568 },
        { width: 360, height: 800 },
        { width: 390, height: 844 },
        { width: 412, height: 915 },
        { width: 768, height: 1024 },
        { width: 1366, height: 768 }
      ]) {
        await page.setViewportSize(viewport)
        await page.goto('/matriculas')
        await expect(page.getByRole('heading', { name: 'Matrículas' })).toBeVisible()
        const list = viewport.width < 640 ? page.getByRole('list') : page.locator('tbody')
        await expect(list.getByRole('button', { name: fixture.enrollmentCode, exact: true })).toBeVisible()
        await expect(list.getByText(fixture.studentName, { exact: true })).toBeVisible()
        await expect(list.getByText('Barbeiro Profissional', { exact: true }).first()).toBeVisible()
        await expect(list.getByText('Pendente', { exact: true }).first()).toBeVisible()
        const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
        expect(metrics.scrollWidth, `overflow em ${viewport.width}x${viewport.height}: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.clientWidth + 1)
      }

      await page.setViewportSize({ width: 1366, height: 768 })
      await page.goto('/matriculas')
      await page.locator('tbody').getByRole('button', { name: fixture.enrollmentCode, exact: true }).click()
      await expect(page).toHaveURL(/\/matriculas\/[^/]+$/)
      await expect(page.getByRole('heading', { name: 'Matrícula' })).toBeVisible()
      await expect(page.getByRole('heading', { name: fixture.enrollmentCode, exact: true })).toBeVisible()
      await expect(page.getByText(fixture.studentCode, { exact: true })).toBeVisible()
      await expect(page.getByText('Barbeiro Profissional', { exact: true })).toBeVisible()
      await expect(page.getByText(fixture.saleCode, { exact: true })).toBeVisible()
      await expect(page.getByText(fixture.contractCode, { exact: true })).toBeVisible()
      await expect(page.getByText('Pendente', { exact: true })).toBeVisible()
    } finally {
      await cleanupE2eRun(runId)
    }
  })

  test('mantém espaços na busca e não cria overflow nos cards mobile', async ({ page }) => {
    test.setTimeout(120_000)
    const runId = `E2E-ENR-UX-${Date.now()}`
    const viewports = [
      { width: 320, height: 568 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 412, height: 915 }
    ]
    try {
      const fixture = await createEnrollmentFixture(page, runId)
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        await page.goto('/matriculas')
        const search = page.getByLabel('Buscar matrículas')
        await search.fill('')
        await search.pressSequentially('QA Manual')
        await expect(search).toHaveValue('QA Manual')
        const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
        expect(metrics.scrollWidth, `overflow em /matriculas ${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(metrics.clientWidth + 1)
      }

      for (const route of ['/vendas', '/contratos', '/alunos']) {
        await page.setViewportSize({ width: 320, height: 568 })
        await page.goto(route)
        const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
        expect(metrics.scrollWidth, `overflow em ${route}`).toBeLessThanOrEqual(metrics.clientWidth + 1)
      }

      await page.setViewportSize({ width: 320, height: 568 })
      await page.goto('/matriculas')
      await page.getByRole('button', { name: fixture.enrollmentCode, exact: true }).click()
      const detailMetrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
      expect(detailMetrics.scrollWidth, 'overflow em detalhe de matrícula').toBeLessThanOrEqual(detailMetrics.clientWidth + 1)
    } finally {
      await cleanupE2eRun(runId)
    }
  })
})
