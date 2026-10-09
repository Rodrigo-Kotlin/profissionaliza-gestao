import { expect, test, type Page } from '@playwright/test'
import { cleanupE2eRun, createEnrollmentFixture } from './enrollment-fixture'
import { hasAdminCredentials } from './helpers'

const VIEWPORTS = [
  [320, 568], [360, 800], [390, 844], [412, 915],
  [768, 1024], [1024, 768], [1366, 768], [1920, 1080]
] as const

async function assertNoOverflow(page: Page, viewport: string) {
  const result = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    offenders: Array.from(document.querySelectorAll<HTMLElement>('*')).flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return rect.right > document.documentElement.clientWidth + 1
        ? [{ tag: element.tagName, className: element.className, right: Math.round(rect.right), text: element.textContent?.trim().slice(0, 80) }]
        : []
    }).slice(0, 5)
  }))
  expect(result.scrollWidth, `${viewport}: horizontal overflow ${JSON.stringify(result.offenders)}`).toBeLessThanOrEqual(result.clientWidth + 1)
  return result
}

test.describe('2.6B3 — homologação não funcional', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('responsividade, offline, teclado e console/network', async ({ page }) => {
    test.setTimeout(180_000)
    const runId = `E2E-B3-NF-${Date.now()}`
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const unexpectedResponses: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400 && ![401, 403, 404].includes(response.status())) {
        unexpectedResponses.push(`${response.request().method()} ${new URL(response.url()).pathname} ${response.status()}`)
      }
    })

    try {
      const fixture = await createEnrollmentFixture(page, runId, {
        method: 'GOV_BR',
        onPendingUpload: async (currentPage) => {
          for (const [width, height] of VIEWPORTS) {
            await currentPage.setViewportSize({ width, height })
            await expect(currentPage.getByRole('heading', { name: 'Formalização da assinatura' })).toBeVisible()
            await expect(currentPage.getByLabel('PDF assinado')).toBeVisible()
            await assertNoOverflow(currentPage, `${width}x${height}`)
          }

          await currentPage.setViewportSize({ width: 320, height: 568 })
          const method = currentPage.locator('label').filter({ hasText: 'Método' }).getByRole('combobox')
          await method.focus()
          await currentPage.keyboard.press('Tab')
          await currentPage.keyboard.press('Shift+Tab')
          await currentPage.keyboard.press('Escape')
          expect(await method.evaluate((element) => document.activeElement === element)).toBe(true)
          const methodBox = await method.boundingBox()
          expect(methodBox?.height ?? 0).toBeGreaterThanOrEqual(44)

          const longFile = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')
          await currentPage.getByLabel('PDF assinado').setInputFiles({
            name: `${'very-long-signed-contract-file-name-'.repeat(8)}.pdf`,
            mimeType: 'application/pdf',
            buffer: longFile
          })
          await currentPage.context().setOffline(true)
          await currentPage.getByRole('button', { name: 'Enviar PDF' }).click()
          await expect(currentPage.getByText(/Sem conexão|conexão/i).last()).toBeVisible()
          await currentPage.context().setOffline(false)
        },
        onReceived: async (currentPage) => {
          await currentPage.context().setOffline(true)
          await currentPage.getByRole('button', { name: 'Confirmar conferência' }).click()
          await expect(currentPage.getByText(/Sem conexão|conexão/i).last()).toBeVisible()
          await currentPage.getByPlaceholder('Motivo obrigatório da rejeição').fill(`${runId} offline rejection reason`) 
          await currentPage.getByRole('button', { name: 'Rejeitar' }).click()
          await expect(currentPage.getByText(/Sem conexão|conexão/i).last()).toBeVisible()
          await currentPage.context().setOffline(false)
        }
      })
      await expect(page.getByRole('heading', { name: fixture.enrollmentCode, exact: true })).toBeVisible()
      await expect(page.getByText('Pendente', { exact: true })).toBeVisible()
      expect(consoleErrors, 'console.error').toEqual([])
      expect(pageErrors, 'pageerror').toEqual([])
      expect(unexpectedResponses, 'unexpected network errors').toEqual([])
    } finally {
      await page.context().setOffline(false)
      await cleanupE2eRun(runId)
    }
  })
})
