import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { loadEnv } from './scripts/lib/env.ts'

loadEnv()

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL('./$1', import.meta.url)) },
      // `server-only` throws outside Next's react-server condition.
      { find: /^server-only$/, replacement: fileURLToPath(new URL('./scripts/lib/empty.cjs', import.meta.url)) },
    ],
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Integration tests share one local Postgres; each test runs in a rolled-back transaction.
    fileParallelism: true,
    pool: 'forks',
  },
})
