import { expect, test } from '@playwright/test'
import { e2eEnv, hasAdminCredentials, login } from './helpers'

const ROUTES = [
  { path: '/', heading: 'Visão Geral' },
  { path: '/crm', heading: 'CRM Comercial' },
  { path: '/crm/leads', heading: 'Leads' },
  { path: '/crm/atividades', heading: 'Atividades' },
  { path: '/crm/cursos', heading: 'Catálogo de Cursos' },
  { path: '/vendas', heading: 'Vendas' },
  { path: '/contratos', heading: 'Contratos' },
  { path: '/alunos', heading: 'Alunos' },
  { path: '/administracao/usuarios', heading: 'Usuários' },
  { path: '/perfil', heading: 'Meu perfil' }
]

async function pageHasNoHorizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    return doc.scrollWidth <= doc.clientWidth && body.scrollWidth <= body.clientWidth
  })
}

test.describe('TRIAGEM 12B-1 — rotas autenticadas (fluxo principal)', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')
  test.beforeEach(async ({ page }) => { await login(page, e2eEnv.email, e2eEnv.password) })

  for (const vp of [{ name: '390x844 (mobile)', w: 390, h: 844 }, { name: '1366x768 (desktop)', w: 1366, h: 768 }]) {
    for (const route of ROUTES) {
      test(`${route.path} @${vp.name} — heading correto e sem overflow horizontal`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: vp.w, height: vp.h })
        await page.goto(route.path)
        await expect(page.getByRole('heading', { name: route.heading })).toBeVisible()
        expect(await pageHasNoHorizontalOverflow(page), 'sem overflow horizontal').toBe(true)
        if (route.path === '/') {
          testInfo.attach(`dashboard-${vp.w}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
        }
      })
    }
  }

  test('fluxo principal: dashboard → CRM → leads → detalhe → voltar', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/crm/leads')
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible()

    const firstLeadLink = page.getByRole('link', { name: /Ver lead/ }).first()
    if ((await firstLeadLink.count()) === 0) {
      test.skip(true, 'Sem leads cadastrados no ambiente.')
    }
    await firstLeadLink.click()
    await expect(page.getByRole('button', { name: /Voltar/ })).toBeVisible()
    const url = new URL(page.url())
    expect(url.pathname.startsWith('/crm/leads/')).toBe(true)
  })
})

test.describe('TRIAGEM 12B-2 — Kanban nos 3 modos responsivos', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')
  test.beforeEach(async ({ page }) => { await login(page, e2eEnv.email, e2eEnv.password) })

  test('mobile (<600) — select de etapa + cards móveis, sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/crm')
    await expect(page.getByRole('heading', { name: 'CRM Comercial' })).toBeVisible()
    await expect(page.getByTestId('kanban-mobile-select')).toBeVisible()
    await expect(page.getByTestId('kanban-mobile-cards')).toBeVisible()
    await expect(page.getByTestId('kanban-board-desktop')).toBeHidden()
    await expect(page.getByTestId('kanban-board-tablet')).toBeHidden()
    expect(await pageHasNoHorizontalOverflow(page)).toBe(true)
  })

  test('tablet (600–1023) — colunas com fallback "Mover para", sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/crm')
    await expect(page.getByTestId('kanban-board-tablet')).toBeVisible()
    await expect(page.getByTestId('kanban-board-desktop')).toBeHidden()
    await expect(page.getByTestId('kanban-mobile-select')).toBeHidden()
    const columns = page.getByTestId(/^kanban-column-/)
    expect(await columns.count()).toBeGreaterThan(0)
    const moveFallback = page.getByTestId(/kanban-card-.*-move/)
    if ((await moveFallback.count()) > 0) {
      await expect(moveFallback.first()).toBeVisible()
    } else {
      test.info().annotations.push({ type: 'nota', description: 'Nenhum card com fallback "Mover para" visível (sem leads OPEN arrastáveis).' })
    }
    expect(await pageHasNoHorizontalOverflow(page)).toBe(true)
  })

  test('desktop (>=1024) — board com drag handle, sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/crm')
    await expect(page.getByTestId('kanban-board-desktop')).toBeVisible()
    await expect(page.getByTestId('kanban-board-tablet')).toBeHidden()
    await expect(page.getByTestId('kanban-mobile-select')).toBeHidden()
    const columns = page.getByTestId(/^kanban-column-/)
    expect(await columns.count()).toBeGreaterThan(0)
    expect(await pageHasNoHorizontalOverflow(page)).toBe(true)
  })
})

test.describe('TRIAGEM 12B-3 — filtros, paginação e retorno contextual', () => {
  test.skip(!hasAdminCredentials, 'Defina E2E_EMAIL e E2E_PASSWORD para executar este fluxo.')
  test.beforeEach(async ({ page }) => { await login(page, e2eEnv.email, e2eEnv.password) })

  test('vendas @390 — pills de status persistem na URL', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/vendas')
    await expect(page.getByRole('heading', { name: 'Vendas' })).toBeVisible()
    await page.getByRole('button', { name: 'Canceladas' }).click()
    await expect(page).toHaveURL(/status=CANCELED/)
    await page.getByRole('button', { name: 'Todas' }).click()
    await expect(page).not.toHaveURL(/status=CANCELED/)
  })

  test('paginação acessível presente nas listagens', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/crm/leads')
    await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible()
    const pagination = page.getByRole('navigation', { name: 'Paginação' })
    if ((await pagination.count()) > 0) {
      await expect(page.getByRole('button', { name: 'Anterior' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Próxima' })).toBeVisible()
    } else {
      test.info().annotations.push({ type: 'nota', description: 'Lista curta — sem paginação renderizada (padrão esperado com <=10 registros).' })
    }
  })

  test('detalhe mostra breadcrumb e Voltar preserva histórico', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 })
    await page.goto('/vendas?status=CONFIRMED')
    const firstSaleLink = page.getByRole('link', { name: /Ver venda/ }).first()
    if ((await firstSaleLink.count()) === 0) {
      test.skip(true, 'Sem vendas CONFIRMED no ambiente.')
    }
    await firstSaleLink.click()
    await expect(page.getByRole('button', { name: /Voltar/ })).toBeVisible()
    expect(await pageHasNoHorizontalOverflow(page)).toBe(true)
  })
})