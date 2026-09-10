import { expect, type Page } from '@playwright/test'

export const e2eEnv = {
  baseUrl: process.env.E2E_BASE_URL || '',
  email: process.env.E2E_EMAIL || '',
  password: process.env.E2E_PASSWORD || '',
  restrictedEmail: process.env.E2E_EMAIL_RESTRICTED || '',
  restrictedPassword: process.env.E2E_PASSWORD_RESTRICTED || ''
}

export const hasAdminCredentials = Boolean(e2eEnv.email && e2eEnv.password)
export const hasRestrictedCredentials = Boolean(e2eEnv.restrictedEmail && e2eEnv.restrictedPassword)
export const hasE2eTarget = Boolean(e2eEnv.baseUrl || hasAdminCredentials || hasRestrictedCredentials)

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail corporativo').fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 })
}

export async function dragTo(page: Page, from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number; width: number; height: number }) {
  const fromX = from.x + from.width / 2
  const fromY = from.y + from.height / 2
  const toX = to.x + to.width / 2
  const toY = to.y + to.height / 2
  await page.mouse.move(fromX, fromY)
  await page.mouse.down()
  await page.mouse.move(fromX + 20, fromY, { steps: 3 })
  await page.mouse.move(toX, toY, { steps: 25 })
  await page.mouse.up()
}