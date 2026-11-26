import { defineConfig, devices } from '@playwright/test'

// BASE_URL lets the same suite run against the live deployment: BASE_URL=https://... npx playwright test
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173'
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : undefined)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL, trace: 'off', screenshot: 'only-on-failure', channel },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], channel } },
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium', channel } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, channel } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, channel } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:9',
          VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'e2e-placeholder',
        },
      },
})
