// Signed-in member and admin journeys. Runs only against a local preview connected to a real Supabase project:
//   E2E_MEMBER_EMAIL=... E2E_ADMIN_EMAIL=... E2E_PASSWORD=... npx playwright test flows --project=desktop
import { expect, test, type Page } from '@playwright/test'

const MEMBER = process.env.E2E_MEMBER_EMAIL
const ADMIN = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.LOADTEST_PASSWORD
const SHOTS = process.env.E2E_SHOTS // folder for screenshots (optional)

test.skip(!MEMBER || !ADMIN || !PASSWORD, 'needs E2E_* credentials for test accounts')

async function login(page: Page, email: string) {
  await page.addInitScript(() => {
    sessionStorage.setItem('mythree-splash', '1')
    localStorage.setItem('mythree-cookie-consent', JSON.stringify({ necessary: true, preferences: true, analytics: false, decidedAt: new Date().toISOString() }))
    localStorage.setItem('mythree-install-dismissed', String(Date.now()))
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD!)
  await page.getByRole('button', { name: 'Login' }).click()
}

const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false })
}

test('member: dashboard → chapter test → result → leaderboard → Guru Dakshina', async ({ page }) => {
  await login(page, MEMBER!)
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText(/Day \d+ of 180/)).toBeVisible()
  await shot(page, '01-dashboard')

  await page.goto('/app/learn')
  await expect(page.getByText('Your learning path')).toBeVisible()
  await shot(page, '02-learn-path')

  await page.getByRole('link', { name: /Chapter 1:/ }).click()
  await page.getByLabel(/I have studied this chapter/).check()
  await page.getByRole('button', { name: /Take chapter test|Retake chapter test|Practise again/ }).click()
  await expect(page.getByText(/Question 1 of/)).toBeVisible()
  await shot(page, '03-test-question')

  // answer every question with the first option / some text, then submit
  const total = Number((await page.getByText(/Question 1 of \d+/).textContent())!.match(/of (\d+)/)![1])
  for (let i = 0; i < total; i++) {
    await expect(page.getByText(new RegExp('Question ' + (i + 1) + ' of'))).toBeVisible()
    await page.waitForTimeout(400) // let the slide animation finish
    const text = page.getByLabel('Your answer')
    if (await text.isVisible().catch(() => false)) await text.fill('आ')
    else await page.locator('button[aria-pressed]').first().click()
    if (i < total - 1) await page.getByRole('button', { name: /^Next/ }).click()
  }
  await page.getByRole('button', { name: /Submit/ }).click()
  await expect(page.getByText(/XP$/).first()).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Review your answers')).toBeVisible()
  await shot(page, '04-test-result')

  await page.goto('/app/leaderboard')
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  await shot(page, '05-leaderboard')

  await page.goto('/app/guru-dakshina')
  await expect(page.getByText(/completely voluntary/)).toBeVisible()
  await shot(page, '06-guru-dakshina')

  await page.goto('/app/final-exam')
  await expect(page.getByText(/Not yet eligible|Congratulations|Readiness confirmed/)).toBeVisible()

  // members are blocked from the admin area
  await page.goto('/admin')
  await expect(page.getByText('Access restricted')).toBeVisible()
})

test('admin: analytics → member table → member profile → exams → chapters → FAQs', async ({ page }) => {
  await login(page, ADMIN!)
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
  await shot(page, '07-admin-overview')

  await page.goto('/admin/members')
  await expect(page.getByRole('columnheader', { name: /Member/ })).toBeVisible()
  await page.getByLabel('Search members').fill('Load Tester 15')
  await expect(page.getByText('Load Tester 150').first()).toBeVisible({ timeout: 10000 })
  await shot(page, '08-admin-members')
  await page.getByText('Load Tester 150').first().click()
  await expect(page.getByText('Chapters completed')).toBeVisible()
  await shot(page, '09-admin-member-detail')

  await page.goto('/admin/exams')
  await expect(page.getByRole('heading', { name: /Final exam/ })).toBeVisible()
  await page.goto('/admin/chapters')
  await expect(page.getByText('The Sanskrit Alphabet')).toBeVisible()
  await shot(page, '10-admin-chapters')
  await page.goto('/admin/faqs')
  await expect(page.getByText(/Is it compulsory/)).toBeVisible()
})
