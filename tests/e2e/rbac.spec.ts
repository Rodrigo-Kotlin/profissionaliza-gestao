import { expect, test } from '@playwright/test'
import { e2eEnv, hasRestrictedCredentials, login } from './helpers'

// E2E-02 — Guarda de rota: usuário sem courses.view deve ver 403 genérico e não vazar conteúdo/permissoes.
test.describe('E2E-02 RBAC — guarda de rota', () => {
  test.skip(!hasRestrictedCredentials, 'Defina E2E_EMAIL_RESTRICTED e E2E_PASSWORD_RESTRICTED para executar este fluxo.')

  test('usuário restrito não acessa /crm/cursos e recebe 403 genérico', async ({ page }) => {
    await login(page, e2eEnv.restrictedEmail, e2eEnv.restrictedPassword)
    await page.goto('/crm/cursos')

    await expect(page.getByRole('heading', { name: 'Você não tem acesso a esta área' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Catálogo de Cursos' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Voltar ao início' })).toBeVisible()
  })

  test('a página de 403 não expõe detalhes internos de permissão', async ({ page }) => {
    await login(page, e2eEnv.restrictedEmail, e2eEnv.restrictedPassword)
    await page.goto('/crm/cursos')

    await expect(page.getByRole('heading', { name: 'Você não tem acesso a esta área' })).toBeVisible()
    await expect(page.getByText(/courses\.view|role_permissions|PERMISSIONS|stage_id/i)).toHaveCount(0)
  })
})