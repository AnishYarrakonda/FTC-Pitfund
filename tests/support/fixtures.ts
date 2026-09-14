import { test as base, expect, type Page } from '@playwright/test'

import type { PersonaKey } from '../../lib/shared/personas'

import { authFile } from './session'

/*
 * `asPersona(persona)` gives a test a page already signed in as that persona, plus a record of
 * console errors, page errors and failed requests that tests can assert is empty.
 */

export type Problems = string[]

export function watchProblems(page: Page, { allow = [] as RegExp[] } = {}): Problems {
  const problems: Problems = []
  const allowed = (text: string) => allow.some((r) => r.test(text))
  page.on('console', (m) => {
    if (m.type() === 'error' && !allowed(m.text())) problems.push(`console: ${m.text().slice(0, 300)}`)
  })
  page.on('pageerror', (e) => {
    if (!allowed(e.message)) problems.push(`pageerror: ${e.message.slice(0, 300)}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && !allowed(`${r.status()} ${r.url()}`)) problems.push(`http ${r.status()} ${r.url()}`)
  })
  return problems
}

export const test = base.extend<{ problems: Problems }>({
  problems: async ({ page }, use) => {
    await use(watchProblems(page))
  },
})

export function asPersona(persona: PersonaKey) {
  return { storageState: authFile(persona) }
}

export { expect }
