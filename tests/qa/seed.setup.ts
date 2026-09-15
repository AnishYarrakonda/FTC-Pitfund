import { rmSync } from 'node:fs'

import { test as base } from '@playwright/test'

import { PERSONAS } from '../../lib/shared/personas'
import { seed } from '../support/seed'
import { storageStateViaToken } from '../support/session'

const test = base.extend<{ scenario: 'demo' | 'edge' | 'empty' }>({ scenario: ['demo', { option: true }] })

/** Reseed the scenario for this QA pass and mint a session per persona (no UI login). */
test('seed scenario and sign in personas', async ({ scenario }) => {
  test.setTimeout(180_000)
  if (scenario === 'demo') rmSync('qa', { recursive: true, force: true })
  seed(scenario)
  for (const persona of PERSONAS) await storageStateViaToken(persona.key)
})
