import 'server-only'

import { z } from 'zod'

/*
 * Server environment, validated once. In production a missing or malformed variable throws
 * at first use (so the deploy fails loudly); in development it warns and falls back to the
 * local Supabase stack defaults written by `npm run setup`. Every variable is documented in
 * .env.example.
 */

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'

const optional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://127.0.0.1:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default(LOCAL_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@127.0.0.1:54322/postgres'),
  SEND_EMAIL_HOOK_SECRET: z.string().startsWith('v1,whsec_'),

  EMAIL_TRANSPORT: z.enum(['smtp', 'resend']).optional(),
  EMAIL_FROM: z.string().min(3).default('FTC Pitfund <noreply@pitfund.test>'),
  SMTP_URL: z.string().default('smtp://127.0.0.1:54325'),
  MAILPIT_URL: z.string().url().default('http://127.0.0.1:54324'),
  RESEND_API_KEY: optional,
  RESEND_WEBHOOK_SECRET: optional,

  CRON_SECRET: optional,
  SENTRY_DSN: optional,
  FIRST_API_USERNAME: optional,
  FIRST_API_TOKEN: optional,
})

export type Env = z.infer<typeof schema> & { EMAIL_TRANSPORT: 'smtp' | 'resend' }

let cached: Env | undefined

function isBuildPhase() {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

export function env(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)
  const isProd = process.env.NODE_ENV === 'production' && !isBuildPhase()

  let values: z.infer<typeof schema>
  if (parsed.success) {
    values = parsed.data
  } else {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    if (isProd && !isLocalSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      throw new Error(`Invalid server environment: ${detail}`)
    }
    if (!isBuildPhase()) console.warn(`[env] ${detail}. Run \`npm run setup\` to write .env.local.`)
    values = schema.parse({
      ...process.env,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'missing',
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || 'missing',
      SEND_EMAIL_HOOK_SECRET: process.env.SEND_EMAIL_HOOK_SECRET?.startsWith('v1,whsec_')
        ? process.env.SEND_EMAIL_HOOK_SECRET
        : 'v1,whsec_missing',
    })
  }

  const transport =
    values.EMAIL_TRANSPORT ?? (values.RESEND_API_KEY && values.NODE_ENV === 'production' ? 'resend' : 'smtp')

  if (isProd && transport === 'resend' && !values.RESEND_API_KEY) {
    throw new Error('Invalid server environment: EMAIL_TRANSPORT=resend requires RESEND_API_KEY')
  }
  if (isProd && !isLocalSupabase(values.NEXT_PUBLIC_SUPABASE_URL) && !values.CRON_SECRET) {
    throw new Error('Invalid server environment: CRON_SECRET is required in production')
  }

  cached = { ...values, EMAIL_TRANSPORT: transport === 'resend' && values.RESEND_API_KEY ? 'resend' : 'smtp' }
  return cached
}

export function isLocalSupabase(url: string | undefined) {
  if (!url) return true
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost'
  } catch {
    return false
  }
}

/** `/dev/*` exists only in a development server pointed at the local Supabase stack. */
export function devToolsEnabled() {
  return process.env.NODE_ENV !== 'production' && isLocalSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

/** Test-only: forget the cached env so a test can change process.env. */
export function resetEnvCache() {
  cached = undefined
}
