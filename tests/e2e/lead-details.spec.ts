import { expect, test } from '@playwright/test'
import { e2eEnv, hasAdminCredentials, login } from './helpers'

// E2E-04 — Detalhe do lead: abre via kanban e navega pelas abas.
test.describe('E2E-04 Detalhe do lead', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('abre um lead pelo kanban e navega pelas abas', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/crm')

    const cards = page.locator('[data-testid^="kanban-card-"]:not([data-testid$="-drag"])')
    if ((await cards.count()) === 0) {
      test.skip(true, 'Nenhum lead disponível no pipeline.')
    }

    await cards.first().click()
    await expect(page).toHaveURL(/\/crm\/leads\/.+/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Lead', exact: true })).toBeVisible()

    const resumo = page.getByRole('tab', { name: 'Resumo' })
    await expect(resumo).toBeVisible()
    await expect(resumo).toHaveAttribute('aria-selected', 'true')

    for (const tab of ['Atividades', 'Histórico', 'Qualificação']) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
    }
  })

  test('lead inexistente mostra estado de não encontrado sem quebrar a UI', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/crm/leads/00000000-0000-0000-0000-000000000000')
    await expect(page.getByText('Lead não encontrado')).toBeVisible()
    await expect(page.getByText('Lead', { exact: true })).toBeHidden()
  })
})