import { expect, test } from '@playwright/test'
import { dragTo, e2eEnv, hasAdminCredentials, login } from './helpers'

// E2E-03 — Kanban: pipeline renderiza colunas e o arrasto otimista move o card de etapa.
test.describe('E2E-03 Kanban — drag and drop', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')

  test('pipeline renderiza colunas e leads', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/crm')
    await expect(page.getByRole('heading', { name: 'CRM Comercial' })).toBeVisible()
    const columns = page.getByTestId(/^kanban-column-/)
    await expect(columns.first()).toBeVisible()
    const columnCount = await columns.count()
    expect(columnCount).toBeGreaterThan(0)
    await expect(columns).toHaveCount(columnCount)
  })

  test('arrastar lead de uma etapa para outra reflete otimistamente na coluna destino', async ({ page }) => {
    await login(page, e2eEnv.email, e2eEnv.password)
    await page.goto('/crm')

    const columns = page.getByTestId(/^kanban-column-/)
    if ((await columns.count()) < 2) {
      test.skip(true, 'É necessário ao menos duas etapas no pipeline.')
    }
    const handles = page.locator('[data-testid$="-drag"]')
    const handleCount = await handles.count()
    if (handleCount === 0) {
      test.skip(true, 'Nenhum lead arrastável (sem CRM_MOVE_STAGE ou sem leads OPEN).')
    }

    const handle = handles.first()
    const cardId = (await handle.getAttribute('data-testid'))!.replace(/-drag$/, '')
    const card = page.getByTestId(cardId)

    const sourceColumn = columns.filter({ has: card })
    await expect(sourceColumn).toHaveCount(1)
    const sourceId = await sourceColumn.first().getAttribute('data-testid')
    const targetColumn = columns.filter({ hasNot: card }).first()
    const targetId = await targetColumn.getAttribute('data-testid')
    expect(sourceId).not.toBe(targetId)

    await dragTo(page, (await handle.boundingBox())!, (await targetColumn.boundingBox())!)

    const pinnedTarget = page.getByTestId(targetId!)
    await expect(pinnedTarget).toBeVisible()
    await expect(pinnedTarget.getByTestId(cardId)).toBeVisible()
  })
})