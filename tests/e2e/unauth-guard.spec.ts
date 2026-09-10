import { expect, test } from '@playwright/test'
import { hasE2eTarget } from './helpers'

// E2E-05 — Rotas protegidas sem sessão redirecionam para /login (não requer credenciais).
test.describe('E2E-05 Guarda de autenticação', () => {
  test.skip(!hasE2eTarget, 'Defina E2E_BASE_URL (ou credenciais) para executar este fluxo.')

  test('visitante sem sessão é redirecionado de / para /login', async ({ page }) => {
    await page.goto('/')
    await page.waitForURL(/\/login/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
  })

  test('visitante sem sessão é redirecionado de /crm para /login', async ({ page }) => {
    await page.goto('/crm')
    await page.waitForURL(/\/login/, { timeout: 15_000 })
    await expect(page.getByText('Você não tem acesso a esta área')).toHaveCount(0)
  })
})