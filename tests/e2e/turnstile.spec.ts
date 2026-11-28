// Cloudflare Turnstile wiring. Runs only when the preview is built with a site key, e.g. Cloudflare's public
// always-pass TEST site key: VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA (no real secret involved).
import { expect, test } from '@playwright/test'

const KEY = process.env.VITE_TURNSTILE_SITE_KEY
const PASSWORD = process.env.E2E_PASSWORD
test.skip(!KEY, 'build the preview with VITE_TURNSTILE_SITE_KEY to run these checks')

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('mythree-splash', '1')
    localStorage.setItem('mythree-cookie-consent', JSON.stringify({ necessary: true, preferences: true, analytics: false, decidedAt: new Date().toISOString() }))
    localStorage.setItem('mythree-install-dismissed', String(Date.now()))
  })
})

test('login, forgot-password and the last registration step show the security check', async ({ page }) => {
  for (const path of ['/login', '/forgot-password']) {
    await page.goto(path)
    // the widget lives in a closed shadow root, so check that Cloudflare rendered it into our box
    const box = page.getByTestId('turnstile')
    await expect(box).toBeVisible()
    await expect.poll(async () => (await box.boundingBox())?.height ?? 0, { timeout: 15000 }).toBeGreaterThan(50)
    await expect.poll(() => box.evaluate((el) => el.childElementCount), { timeout: 15000 }).toBeGreaterThan(0)
  }
  await page.goto('/register')
  await expect(page.getByTestId('turnstile')).toHaveCount(0) // only on the final step
})

test('login succeeds once the check is passed (staging Auth ignores the token while CAPTCHA is off there)', async ({ page }) => {
  test.skip(!PASSWORD, 'needs the staging test password')
  await page.goto('/login')
  await page.getByLabel('Email').fill('loadtest+61@mythree.test')
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD!)
  // the always-pass test key solves itself within a few seconds
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 20000 })
})
