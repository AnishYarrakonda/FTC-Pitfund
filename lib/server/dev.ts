import 'server-only'

import { spawn } from 'node:child_process'

import { notFound } from 'next/navigation'

import { personaEmail, type PersonaKey } from '@/lib/shared/personas'

import { asc, isNotNull } from 'drizzle-orm'

import { getDb } from './db'
import { devToolsEnabled } from './env'
import { teams } from './schema'
import { publicUrl } from './storage'
import { createSupabaseServerClient } from './supabase'
import { createSupabaseAdminClient } from './supabase-admin'

/*
 * Local development tools behind /dev. Every entry point calls `assertDevTools()`, which
 * 404s unless this is a development server pointed at the local Supabase stack.
 */

export function assertDevTools() {
  if (!devToolsEnabled()) notFound()
}

/**
 * Sign in as a persona without email: the admin API mints a magic-link token and the
 * cookie-bound client verifies it, which sets the session cookies on this response.
 */
export async function signInAsPersona(persona: PersonaKey) {
  assertDevTools()
  const email = personaEmail(persona)
  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties?.hashed_token) {
    throw new Error(`Persona ${persona} isn't seeded (${error?.message ?? 'no token'}). Run \`npm run seed\`.`)
  }
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'local' })
  const verified = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token })
  if (verified.error) throw new Error(`Persona sign-in failed: ${verified.error.message}`)
  return verified.data.user
}

/** A seeded deck for the /dev/ui PdfViewer, if the demo data exists. */
export async function sampleDeck() {
  assertDevTools()
  const [team] = await getDb()
    .select({ name: teams.name, pdfPath: teams.pdfPath, pdfPages: teams.pdfPages, thumb: teams.pdfThumbPath, logo: teams.logoPath })
    .from(teams)
    .where(isNotNull(teams.pdfPath))
    .orderBy(asc(teams.number))
    .limit(1)
  if (!team) return null
  return { name: team.name, src: publicUrl(team.pdfPath)!, pages: team.pdfPages, thumb: publicUrl(team.thumb), logo: publicUrl(team.logo) }
}

const SIMULATE_COOKIE = 'pitfund-simulate'

/**
 * Failure injection for local verification and E2E (never active in production): set the cookie
 * `pitfund-simulate` to a comma list such as `ftc-timeout,save-draft` and the named step fails
 * the way the real outage would. Keys: ftc-timeout, ftc-not-found, save-draft, submit-pitch.
 */
export async function simulated(key: string): Promise<boolean> {
  if (!devToolsEnabled()) return false
  const { cookies } = await import('next/headers')
  const value = (await cookies()).get(SIMULATE_COOKIE)?.value ?? ''
  return value.split(',').map((v) => v.trim()).includes(key)
}

export function runSeed(scenario: 'demo' | 'empty' | 'edge'): Promise<{ ok: boolean; output: string }> {
  assertDevTools()
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', '--import', './scripts/lib/server-only-stub.mjs', 'scripts/seed/index.ts', '--scenario', scenario],
      { cwd: process.cwd(), env: process.env },
    )
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.on('close', (code) => resolve({ ok: code === 0, output: output.slice(-2000) }))
  })
}
