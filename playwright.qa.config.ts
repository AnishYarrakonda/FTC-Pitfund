import { defineConfig, devices } from '@playwright/test'

import { DEV_URL, PROD_URL } from './tests/support/env'

/*
 * npm run qa — the visual/UX sweep over tests/qa/routes.ts, on the `demo` scenario, then `edge`
 * (extreme content), then `empty` (first-run and empty states). Runs against a local production build (:3100) plus the dev server
 * (:3000) for dev-only routes. Output (gitignored): qa/screens, qa/results, qa/report.{json,md}.
 */
export default defineConfig({
  testDir: 'tests/qa',
  globalTeardown: './tests/qa/report.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  timeout: 120_000,
  reporter: [['list']],
  outputDir: 'test-results/qa',
  use: { ...devices['Desktop Chrome'], trace: 'off' },
  projects: [
    { name: 'seed-demo', testMatch: /seed\.setup\.ts/, use: { scenario: 'demo' } as object },
    { name: 'demo', testMatch: /qa\.spec\.ts/, dependencies: ['seed-demo'], use: { scenario: 'demo' } as object },
    { name: 'seed-edge', testMatch: /seed\.setup\.ts/, dependencies: ['demo'], use: { scenario: 'edge' } as object },
    { name: 'edge', testMatch: /qa\.spec\.ts/, dependencies: ['seed-edge'], use: { scenario: 'edge' } as object },
    { name: 'seed-empty', testMatch: /seed\.setup\.ts/, dependencies: ['edge'], use: { scenario: 'empty' } as object },
    { name: 'empty', testMatch: /qa\.spec\.ts/, dependencies: ['seed-empty'], use: { scenario: 'empty' } as object },
  ],
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
