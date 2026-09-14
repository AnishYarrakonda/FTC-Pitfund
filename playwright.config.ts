import { defineConfig, devices } from '@playwright/test'

import { DEV_URL, PROD_URL } from './tests/support/env'

/*
 * npm run e2e — journeys against the local stack.
 *   dev server  (:3000) the app under test; the Supabase Send Email hook calls it, so login
 *                emails really flow through the outbox into Mailpit.
 *   prod server (:3100) a production build, used only to prove /dev is a 404 there.
 * Tests run serially: several of them change shared state (the email quota, the seed).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: DEV_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
  webServer: [
    {
      command: 'npm run dev',
      url: `${DEV_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'node --import tsx --import ./scripts/lib/server-only-stub.mjs scripts/serve-prod.ts',
      url: `${PROD_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 600_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
