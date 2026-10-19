import { expect, test } from '@playwright/test'

test.describe('offline detection', () => {
  test('context.setOffline(false/true) updates navigator.onLine', async ({ page, context }) => {
    await page.goto('about:blank')
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true)

    await context.setOffline(true)
    await expect.poll(() => page.evaluate(() => navigator.onLine), { timeout: 3_000 }).toBe(false)

    await context.setOffline(false)
    await expect.poll(() => page.evaluate(() => navigator.onLine), { timeout: 3_000 }).toBe(true)
  })
})
