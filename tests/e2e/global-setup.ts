import { request } from '@playwright/test'

import { PERSONAS } from '../../lib/shared/personas'
import { DEV_URL } from '../support/env'
import { seed } from '../support/seed'
import { storageStateViaDevEndpoint } from '../support/session'

/** Seed `demo`, then sign every persona in through /api/dev/sign-in and save its storageState. */
export default async function globalSetup() {
  seed('demo')
  for (const persona of PERSONAS) {
    // A fresh context per persona so cookies never leak between saved states.
    const api = await request.newContext()
    try {
      await storageStateViaDevEndpoint(api, DEV_URL, persona.key)
    } finally {
      await api.dispose()
    }
  }
}
