import { spawnSync } from 'node:child_process'

import { assertLocalStack } from './env'

/** Reseed the local stack (idempotent; persona auth ids are stable across runs). */
export function seed(scenario: 'demo' | 'empty' | 'edge') {
  assertLocalStack()
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--import', './scripts/lib/server-only-stub.mjs', 'scripts/seed/index.ts', '--scenario', scenario],
    { encoding: 'utf8', env: process.env },
  )
  if (result.status !== 0) throw new Error(`Seeding "${scenario}" failed:\n${result.stdout}\n${result.stderr}`)
}
