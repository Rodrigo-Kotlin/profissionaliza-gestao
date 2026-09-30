import { test, expect, type Page, type Locator } from '@playwright/test'

const VIEWPORTS = [
  { name: '320x568 (iPhone SE)', width: 320, height: 568 },
  { name: '360x800 (Android)', width: 360, height: 800 },
  { name: '375x667 (iPhone 8)', width: 375, height: 667 },
  { name: '390x844 (iPhone 12/13)', width: 390, height: 844 },
  { name: '412x915 (Android)', width: 412, height: 915 },
  { name: '600x960 (tablet)', width: 600, height: 960 },
  { name: '768x1024 (iPad)', width: 768, height: 1024 },
  { name: '820x1180 (iPad Pro 11)', width: 820, height: 1180 },
  { name: '1024x768 (desktop)', width: 1024, height: 768 },
  { name: '1366x768 (desktop)', width: 1366, height: 768 },
  { name: '1440x900 (desktop)', width: 1440, height: 900 },
  { name: '1920x1080 (desktop)', width: 1920, height: 1080 }
]

const CRITICAL_BREAKPOINTS = [320, 390, 768, 1440]

async function noHorizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    return doc.scrollWidth <= doc.clientWidth && body.scrollWidth <= body.clientWidth
  })
}

function withinViewport(page: Page) {
  return async (locator: Locator) => {
    const box = await locator.boundingBox()
    if (!box) return false
    return page.evaluate((b) => b.x >= 0 && b.y >= 0 && b.x + b.width <= window.innerWidth, box)
  }
}

function touchTargetOk(page: Page, min = 44) {
  return async (locator: Locator) => {
    const box = await locator.boundingBox()
    if (!box) return false
    return box.width >= min && box.height >= min
  }
}

test.describe('TRIAGEM 12A — página de login na matriz de viewports', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} — sem overflow, controles visíveis e alvos confortáveis`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()

      expect(await noHorizontalOverflow(page), 'não deve haver overflow horizontal').toBe(true)

      const entrar = page.getByRole('button', { name: 'Entrar', exact: true })
      const email = page.getByLabel('E-mail corporativo')
      const senha = page.getByLabel('Senha', { exact: true })
      const toggle = page.getByRole('button', { name: /Mostrar senha/ })

      for (const el of [entrar, email, senha, toggle]) {
        expect(await withinViewport(page)(el), 'controle deve estar dentro do viewport').toBe(true)
      }

      const isMobile = vp.width < 768
      if (isMobile) {
        expect(await touchTargetOk(page)(entrar), 'Entrar deve ter alvo >= 44px').toBe(true)
        expect(await touchTargetOk(page)(email), 'input de e-mail deve ter altura >= 44px').toBe(true)
        expect(await touchTargetOk(page)(senha), 'input de senha deve ter altura >= 44px').toBe(true)
        const toggleBox = await toggle.boundingBox()
        testInfo.annotations.push({ type: 'touch-toggle', description: `toggle senha: ${toggleBox?.width}x${toggleBox?.height}px no viewport ${vp.width}x${vp.height}` })
      }

      if (CRITICAL_BREAKPOINTS.includes(vp.width)) {
        const shot = await page.screenshot({ fullPage: true })
        testInfo.attach(`login-${vp.width}x${vp.height}.png`, { body: shot, contentType: 'image/png' })
        await page.screenshot({ fullPage: true, path: `test-results/e2e/login-${vp.width}x${vp.height}.png` })
      }
    })
  }
})

test.describe('TRIAGEM 12A — emulação de dispositivos reais', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  })
  test('iPhone 13 — login renderiza sem overflow', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
    expect(await page.getByRole('button', { name: 'Entrar', exact: true }).boundingBox()).not.toBeNull()
    await page.screenshot({ fullPage: true, path: 'test-results/e2e/device-iphone13.png' })
  })

  test.use({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  })
  test('Pixel 7 — login renderiza sem overflow', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
    expect(await page.getByRole('button', { name: 'Entrar', exact: true }).boundingBox()).not.toBeNull()
    await page.screenshot({ fullPage: true, path: 'test-results/e2e/device-pixel7.png' })
  })

  test.use({
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  })
  test('iPad gen 7 em landscape — login renderiza sem overflow', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
    expect(await noHorizontalOverflow(page)).toBe(true)
    await page.screenshot({ fullPage: true, path: 'test-results/e2e/device-ipad-landscape.png' })
  })
})

test.describe('TRIAGEM 12A — PWA manifest e service worker', () => {
  test('manifest.webmanifest válido e ícones servidos', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)
    const manifest = await res.json()
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.lang).toBe('pt-BR')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4)
    for (const icon of manifest.icons) {
      const iconRes = await request.get(icon.src)
      expect(iconRes.status(), `ícone ${icon.src} deve responder 200`).toBe(200)
    }
  })

  test('service worker registrado e ativo', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const active = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return Boolean(reg.active)
    })
    expect(active).toBe(true)
  })

  test('sw.js servido no escopo raiz', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBe(200)
    expect((await res.text()).toLowerCase()).toContain('workbox')
  })
})

test.describe('TRIAGEM 12A — shell offline via service worker', () => {
  test('recarrega o login offline a partir do precache', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
    const controlled = await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready)?.active))
    expect(controlled).toBe(true)

    await page.context().setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible({ timeout: 10_000 })
    await page.context().setOffline(false)
  })
})

test.describe('TRIAGEM 12A — guardas de rota sem sessão', () => {
  for (const path of ['/', '/crm', '/alunos', '/vendas', '/contratos', '/crm/leads', '/administracao/usuarios']) {
    test(`rota protegida ${path} redireciona para /login`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
      expect(page.url()).toContain('/login')
    })
  }
})

test.describe('TRIAGEM 12A — recuperar senha', () => {
  for (const vp of [{ name: '320x568', width: 320, height: 568 }, { name: '390x844', width: 390, height: 844 }, { name: '1440x900', width: 1440, height: 900 }]) {
    test(`${vp.name} — recuperar senha sem overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.goto('/recuperar-senha', { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible()
      expect(await noHorizontalOverflow(page)).toBe(true)
      const enviar = page.getByRole('button', { name: 'Enviar link' })
      expect(await withinViewport(page)(enviar)).toBe(true)
      expect(await touchTargetOk(page)(enviar)).toBe(true)
    })
  }
})

test.describe('TRIAGEM 12A — credenciais inválidas', () => {
  test('mantém na tela de login com mensagem de erro', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('E-mail corporativo').fill('nao-existe@instituicao.com.br')
    await page.getByLabel('Senha', { exact: true }).fill('senha-invalida-1')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
    expect(page.url()).toContain('/login')
  })
})