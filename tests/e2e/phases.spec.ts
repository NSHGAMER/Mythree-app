// Phase 1–5 journeys against a local preview connected to the STAGING Supabase project:
//   VITE_SUPABASE_URL=<staging> VITE_SUPABASE_PUBLISHABLE_KEY=<staging> E2E_PASSWORD=... npx playwright test phases
import { expect, test, type Page } from '@playwright/test'

const PASSWORD = process.env.E2E_PASSWORD ?? process.env.LOADTEST_PASSWORD
const SHOTS = process.env.E2E_SHOTS
test.skip(!PASSWORD || !/mxxkpcincouaniqryzfy/.test(process.env.VITE_SUPABASE_URL ?? ''), 'needs the staging project and test password')

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
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` })
}

test('pending member is sent to the ₹151 registration page and cannot open learning', async ({ page }) => {
  await login(page, 'pending+2@mythree.test')
  await expect(page).toHaveURL(/\/app\/registration/, { timeout: 15000 })
  await expect(page.getByRole('heading', { name: /Complete your registration/ })).toBeVisible()
  await expect(page.getByText(/151/).first()).toBeVisible()
  await shot(page, 'p01-registration-pending')
  await page.goto('/app/learn')
  await expect(page).toHaveURL(/\/app\/registration/)
  await page.goto('/app/settings')
  await expect(page).toHaveURL(/\/app\/settings/)
})

test('confirmed member: UID on dashboard, video classes, exam page, chatbot suggestions', async ({ page }) => {
  await login(page, 'loadtest+21@mythree.test')
  await expect(page).toHaveURL(/\/app$/, { timeout: 15000 })
  await expect(page.getByText('LOAD0021').first()).toBeVisible()
  await shot(page, 'p02-dashboard-uid')

  await page.goto('/app/videos')
  await expect(page.getByRole('heading', { name: 'Video classes' })).toBeVisible()
  await shot(page, 'p03-videos')

  await page.goto('/app/exam')
  await expect(page.getByRole('heading', { name: 'Final examination' })).toBeVisible()
  await expect(page.getByText(/Staging exam|February 2027|Feb 2027/).first()).toBeVisible()
  await shot(page, 'p04-exam')

  await page.goto('/app')
  await page.getByRole('button', { name: 'Open help chat' }).click()
  await page.getByRole('button', { name: 'Show suggested questions' }).click()
  const list = page.getByRole('listbox', { name: 'Suggested questions' })
  await expect(list).toBeVisible()
  const first = list.getByRole('option').first()
  const q = (await first.textContent())!.trim()
  await first.click()
  await expect(list).toBeHidden()
  await expect(page.getByLabel('Your question')).toHaveValue(q)
  await shot(page, 'p05-chatbot-suggestion')
})

test('admin: registrations, videos, challenge sets, exam schedules, evaluation pages load', async ({ page }) => {
  await login(page, 'admin-test@mythree.test')
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 })
  await page.goto('/admin/registrations')
  await expect(page.getByRole('heading', { name: /Registrations & member IDs/ })).toBeVisible()
  await expect(page.getByText(/LOAD\d{4}/).first()).toBeVisible({ timeout: 15000 })
  await shot(page, 'p06-admin-registrations')
  for (const [path, heading] of [
    ['/admin/videos', 'Video lessons'],
    ['/admin/challenges', 'Daily & weekly tests'],
    ['/admin/exam-schedules', 'Exam schedules'],
    ['/admin/evaluation', 'Evaluation & results'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await shot(page, `p07-${path.split('/').pop()}`)
  }
})

test('registration asks for an English spelling when the name is in another script', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('mythree-splash', '1')
    sessionStorage.removeItem('mythree-register-draft')
    localStorage.setItem('mythree-cookie-consent', JSON.stringify({ necessary: true, preferences: true, analytics: false, decidedAt: new Date().toISOString() }))
    localStorage.setItem('mythree-install-dismissed', String(Date.now()))
  })
  await page.goto('/register')
  await expect(page.getByLabel('Name in English letters')).toHaveCount(0)
  await page.getByLabel('Full name').fill('ಸುಬ್ರಹ್ಮಣ್ಯ')
  await expect(page.getByLabel('Name in English letters')).toBeVisible()
  await shot(page, 'p08-register-english-name')
  await page.getByLabel('Full name').fill('Subramanya')
  await expect(page.getByLabel('Name in English letters')).toHaveCount(0)
})
