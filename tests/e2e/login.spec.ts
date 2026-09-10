import { expect, test } from '@playwright/test'
import { e2eEnv, hasAdminCredentials, login } from './helpers'

// E2E-01 — Login com perfil administrador e acesso ao dashboard.
test.describe('E2E-01 Login', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('administrador entra e vê o dashboard', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Menu principal' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'CRM' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Alunos' })).toBeVisible()
  })

  test('credenciais inválidas não autenticam e mantêm na tela de login', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail corporativo').fill('nao-existe@instituicao.com.br')
    await page.getByLabel('Senha', { exact: true }).fill('senha-invalida-1')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
  })
})