import { expect, test } from '@playwright/test'
import { e2eEnv, hasAdminCredentials, login } from './helpers'

test.describe('Matrículas — navegação autenticada', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('ADMIN acessa a listagem e mantém layout mobile sem overflow', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/matriculas')
    await expect(page.getByRole('heading', { name: 'Matrículas' })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { name: 'Matrículas' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('ADMIN abre o detalhe de uma matrícula existente', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/matriculas')
    const enrollmentLink = page.getByRole('button', { name: /^MAT-\d{4}-\d{6}$/ }).first()
    if (await enrollmentLink.count() === 0) test.skip(true, 'DEV não possui matrícula para o smoke de detalhe.')
    await enrollmentLink.click()
    await expect(page).toHaveURL(/\/matriculas\/[^/]+$/)
    await expect(page.getByRole('heading', { name: 'Matrícula' })).toBeVisible()
  })
})
