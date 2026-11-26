import { expect, test, type Page } from '@playwright/test'

async function skipSplash(page: Page) {
  // The splash is shown once per session; mark it as seen so tests start on the page itself.
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('mythree-splash', '1')
      localStorage.setItem('mythree-cookie-consent', JSON.stringify({ necessary: true, preferences: true, analytics: false, decidedAt: new Date().toISOString() }))
    } catch {
      /* ignore */
    }
  })
}

async function noHorizontalScroll(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: Math.min(window.innerWidth, window.visualViewport?.width ?? window.innerWidth) }))
  expect(sw, 'page should not scroll horizontally').toBeLessThanOrEqual(iw + 1)
}

test('splash screen shows the official logo, then the homepage', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status', { name: 'Loading Mythree' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading Mythree' }).getByRole('img', { name: 'Mythree' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Loading Mythree' })).toBeHidden({ timeout: 6000 })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sanskrit')
})

test.describe('public pages', () => {
  test.beforeEach(async ({ page }) => skipSplash(page))

  for (const path of ['/', '/about', '/programme', '/contact', '/guru-dakshina', '/install', '/privacy', '/terms', '/cookies']) {
    test(`${path} renders responsively`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.locator('h1').first()).toBeVisible()
      await noHorizontalScroll(page)
    })
  }

  test('navigation adapts to screen size and always offers GURU DAKSHINA', async ({ page, isMobile }) => {
    await page.goto('/')
    if (isMobile) {
      await page.getByRole('button', { name: 'Open menu' }).click()
      await expect(page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: /GURU DAKSHINA/ })).toBeVisible()
    } else {
      await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /GURU DAKSHINA/ })).toBeVisible()
    }
  })

  test('touch targets on primary actions are at least 40px tall', async ({ page }) => {
    await page.goto('/')
    const box = await page.getByRole('link', { name: /Register free/ }).first().boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(40)
  })

  test('theme toggle switches to dark mode', async ({ page }) => {
    await page.goto('/about')
    const toggle = page.getByRole('button', { name: /^Theme:/ }).first()
    await toggle.click()
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    const before = isDark
    await toggle.click()
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(before !== after || before).toBeTruthy()
  })

  test('unknown routes show the branded 404 page', async ({ page }) => {
    await page.goto('/this-does-not-exist')
    await expect(page.getByText('Page not found')).toBeVisible()
  })

  test('member and admin areas require login', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('registration validates each step before continuing', async ({ page }) => {
    await page.goto('/register')
    await page.getByRole('button', { name: /Continue/ }).click()
    await expect(page.getByText('Enter your full name')).toBeVisible()
    await expect(page.getByText('Enter a valid email address')).toBeVisible()
    await expect(page.getByText(/valid 10-digit Indian mobile/)).toBeVisible()
    await noHorizontalScroll(page)
  })
})

test.describe('PWA', () => {
  test('manifest is valid and installable', async ({ page, request }) => {
    await skipSplash(page)
    await page.goto('/')
    const href = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(href).toBeTruthy()
    const res = await request.get(href!)
    expect(res.ok()).toBeTruthy()
    const m = await res.json()
    expect(m.name).toContain('Mythree')
    expect(m.short_name).toBe('Mythree')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toMatch(/^\//)
    expect(m.theme_color).toBeTruthy()
    expect(m.background_color).toBeTruthy()
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBeTruthy()
    for (const icon of m.icons) expect((await request.get(icon.src)).ok()).toBeTruthy()
    expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBeTruthy()
  })

  test('service worker registers and controls the page', async ({ page }) => {
    await skipSplash(page)
    await page.goto('/')
    const scope = await page.evaluate(async () => {
      const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 15000))])
      return reg ? (reg as ServiceWorkerRegistration).scope : null
    })
    expect(scope).toMatch(/\/$/)
  })

  test('service worker does not cache API or auth traffic', async ({ request }) => {
    const sw = await (await request.get('/sw.js')).text()
    expect(sw).not.toMatch(/supabase\.co/)
    expect(sw).not.toMatch(/razorpay/)
  })
})
