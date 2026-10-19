import { expect, test } from '@playwright/test'
import { e2eEnv, hasRestrictedCredentials, login } from './helpers'

// E2E-02 — Conta VENDEDOR mantém courses.view, sem expor detalhes internos de RBAC.
test.describe('E2E-02 RBAC — escopo do vendedor', () => {
  test.skip(!hasRestrictedCredentials, 'Defina E2E_EMAIL_RESTRICTED e E2E_PASSWORD_RESTRICTED para executar este fluxo.')

  test('vendedor acessa o catálogo permitido', async ({ page }) => {
    await login(page, e2eEnv.restrictedEmail, e2eEnv.restrictedPassword)
    await page.goto('/crm/cursos')

    await expect(page.getByRole('heading', { name: 'Catálogo de Cursos' })).toBeVisible()
  })

  test('a área permitida não expõe detalhes internos de permissão', async ({ page }) => {
    await login(page, e2eEnv.restrictedEmail, e2eEnv.restrictedPassword)
    await page.goto('/crm/cursos')

    await expect(page.getByRole('heading', { name: 'Catálogo de Cursos' })).toBeVisible()
    await expect(page.getByText(/role_permissions|PERMISSIONS|stage_id/i)).toHaveCount(0)
  })
})
