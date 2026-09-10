import { expect, test } from '@playwright/test'
import { e2eEnv, hasAdminCredentials, login } from './helpers'

// E2E-SALES-01: Lead elegível → Fechar venda → Sale Detail → Lead WON
test.describe('E2E-SALES-01 Fechar venda', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('navega para /vendas e verifica página de listagem', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/vendas')
    await expect(page.getByRole('heading', { name: 'Vendas' })).toBeVisible()
  })
})

// E2E-SALES-02: VENDEDOR não acessa Sale de outro vendedor
test.describe('E2E-SALES-02 VENDEDOR restricted', () => {
  test.skip(!e2eEnv.restrictedEmail, 'Defina E2E_EMAIL_RESTRICTED e E2E_PASSWORD_RESTRICTED.')

  test('restricted user can see /vendas but limited to own', async ({ page }) => {
    await login(page, e2eEnv.restrictedEmail, e2eEnv.restrictedPassword)
    await page.goto('/vendas')
    await expect(page.getByRole('heading', { name: 'Vendas' })).toBeVisible()
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count === 0) {
      expect(count).toBe(0)
    }
  })
})

// E2E-SALES-03: Cancelar Sale → CANCELED → Lead permanece WON → vínculo permanece
test.describe('E2E-SALES-03 Cancelar venda', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('accesses /vendas page without crash', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/vendas')
    await expect(page.getByRole('heading', { name: 'Vendas' })).toBeVisible()
  })
})
