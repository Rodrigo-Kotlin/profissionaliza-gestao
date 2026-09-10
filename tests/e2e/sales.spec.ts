import { expect, test } from '@playwright/test'
import { e2eEnv, hasAdminCredentials, login } from './helpers'

// E2E-SALES-01: Smoke — ADMIN can access /vendas
// Real flow: Lead (NEGOTIATION) → Close Sale wizard → confirm → /vendas/:id → validate sale_code → Lead WON
// Currently manual QA due to: requires pre-existing Lead fixture, course selection, wizard interaction
test.describe('E2E-SALES-01 /vendas smoke (ADMIN)', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('ADMIN can access /vendas and see page heading', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/vendas')
    await expect(page.getByRole('heading', { name: 'Vendas' })).toBeVisible()
  })
})

// E2E-SALES-02: Smoke — restricted user can access /vendas with limited rows
// Real flow: VENDEDOR B → navigate to VENDEDOR A's Sale by ID → backend denies → no data visible
// Currently manual QA due to: requires two separate seller accounts + pre-existing Sale
test.describe('E2E-SALES-02 /vendas smoke (restricted user)', () => {
  test.skip(!e2eEnv.restrictedEmail, 'Defina E2E_EMAIL_RESTRICTED e E2E_PASSWORD_RESTRICTED.')

  test('restricted user can see /vendas page', async ({ page }) => {
    await login(page, e2eEnv.restrictedEmail, e2eEnv.restrictedPassword)
    await page.goto('/vendas')
    await expect(page.getByRole('heading', { name: 'Vendas' })).toBeVisible()
  })
})

// E2E-SALES-03: Smoke — ADMIN can access /vendas for cancel flow verification
// Real flow: ADMIN → open Sale (CONFIRMED) → Cancel → reason → CANCELED → Lead still WON → link preserved
// Currently manual QA due to: requires CONFIRMED Sale with linked Lead
test.describe('E2E-SALES-03 /vendas smoke (cancel flow prep)', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('ADMIN can access /vendas page', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/vendas')
    await expect(page.getByRole('heading', { name: 'Vendas' })).toBeVisible()
  })
})
