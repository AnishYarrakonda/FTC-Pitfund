import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { APIRequestContext } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

import { personaEmail, type PersonaKey } from '../../lib/shared/personas'

import { assertLocalStack, SUPABASE_URL } from './env'

/*
 * Persona sessions for Playwright, never by driving the login UI:
 *   - E2E (dev server): GET /api/dev/sign-in, the same endpoint the /dev page uses.
 *   - QA (production build, where /dev doesn't exist): mint the same magic-link token with the
 *     local admin key and let @supabase/ssr write the cookies it would have set.
 */

export const authFile = (persona: PersonaKey) => `tests/.auth/${persona}.json`

export async function storageStateViaDevEndpoint(request: APIRequestContext, baseURL: string, persona: PersonaKey) {
  const res = await request.get(`${baseURL}/api/dev/sign-in?persona=${persona}`, { maxRedirects: 0 })
  if (res.status() !== 303) throw new Error(`Dev sign-in for ${persona} failed: ${res.status()} ${await res.text()}`)
  const path = authFile(persona)
  mkdirSync(dirname(path), { recursive: true })
  await request.storageState({ path })
  return path
}

export async function storageStateViaToken(persona: PersonaKey, host = '127.0.0.1') {
  assertLocalStack()
  const secret = process.env.SUPABASE_SECRET_KEY
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!secret || !publishable) throw new Error('Supabase keys missing. Run `npm run setup`.')

  const admin = createClient(SUPABASE_URL, secret, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: personaEmail(persona) })
  if (error || !data.properties?.hashed_token) throw new Error(`Persona ${persona} isn't seeded: ${error?.message}`)

  const jar = new Map<string, string>()
  const client = createServerClient(SUPABASE_URL, publishable, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const c of cookies) {
          if (c.value) jar.set(c.name, c.value)
          else jar.delete(c.name)
        }
      },
    },
  })
  const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token })
  if (verified.error) throw new Error(`Persona sign-in failed: ${verified.error.message}`)

  const state = {
    cookies: [...jar].map(([name, value]) => ({
      name,
      value,
      domain: host,
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    })),
    origins: [],
  }
  const path = `tests/.auth/qa-${persona}.json`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2))
  return path
}
