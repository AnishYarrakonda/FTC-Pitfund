'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { assertDevTools, runSeed, signInAsPersona } from '@/lib/server/dev'
import { AppError, defineAction } from '@/lib/server/result'
import { loadViewer } from '@/lib/server/viewer'
import { PERSONAS } from '@/lib/shared/personas'
import { homeFor } from '@/lib/shared/viewer'

const personaKeys = PERSONAS.map((p) => p.key) as [string, ...string[]]

export async function switchPersona(formData: FormData) {
  assertDevTools()
  const persona = z.enum(personaKeys).parse(formData.get('persona'))
  const user = await signInAsPersona(persona as (typeof PERSONAS)[number]['key'])
  const viewer = user ? await loadViewer(user.id) : null
  redirect(viewer ? homeFor(viewer) : '/welcome')
}

export const resetData = defineAction(z.object({ scenario: z.enum(['demo', 'empty', 'edge']) }), async ({ scenario }) => {
  assertDevTools()
  const result = await runSeed(scenario)
  if (!result.ok) throw new AppError('UNAVAILABLE', `Seeding "${scenario}" failed. ${result.output.split('\n').filter(Boolean).slice(-2).join(' ')}`)
  return { scenario }
})

/* Fake actions for the /dev/ui gallery: slow success, slow failure, network-style failure. */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const fakeSlowSuccess = defineAction(z.object({}), async () => {
  assertDevTools()
  await delay(1500)
  return { done: true }
})

export const fakeSlowFailure = defineAction(z.object({}), async () => {
  assertDevTools()
  await delay(1200)
  throw new AppError('CONFLICT', 'Another reviewer already decided this pitch.')
})

export const fakeUnexpectedFailure = defineAction(z.object({}), async () => {
  assertDevTools()
  await delay(600)
  throw new Error('Simulated unexpected failure from /dev/ui')
})

export const fakeFieldFailure = defineAction(z.object({ name: z.string() }), async ({ name }) => {
  assertDevTools()
  await delay(800)
  if (name.trim().length < 3) throw new AppError('VALIDATION', 'Use at least 3 characters', { field: 'name' })
  return { name }
})
