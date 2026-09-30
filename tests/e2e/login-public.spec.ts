import { expect, test } from '@playwright/test'
import { hasE2eTarget } from './helpers'

test.describe('Login público — responsividade e acessibilidade', () => {
  test.skip(!hasE2eTarget, 'Defina E2E_BASE_URL para executar o fluxo público.')

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 }
  ]) {
    test(`${viewport.width}x${viewport.height} não cria overflow e mantém controles utilizáveis`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/login')

      await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
      await expect(page.getByLabel('E-mail corporativo')).toBeVisible()
      await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toBeVisible()

      const toggle = page.getByRole('button', { name: 'Mostrar senha' })
      const box = await toggle.boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    })
  }
})
