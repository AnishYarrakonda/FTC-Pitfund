/*
 * npm run provision [-- --dry-run]
 *
 * Builds production from zero, in order: Supabase (projects, migrations, buckets, auth, staging seed,
 * admins) → Vercel (project, Git, env, domain) → Resend (domain, webhook, sending key) → Sentry
 * (optional) → Supabase auth again (the staging hook needs the Vercel bypass secret). Each step is
 * idempotent. When something needs a human (DNS, the Google OAuth client, the Vercel GitHub app) it
 * is listed at the end with exactly what to do; run `npm run provision` again afterwards and it
 * resumes. Finish with `npm run provision:verify`.
 */
import { dryRun, finish, getValue, heading, report } from './lib'
import { provisionResend } from './resend'
import { provisionSentry } from './sentry'
import { provisionSupabase } from './supabase'
import { provisionVercel } from './vercel'

async function main() {
  console.log(`FTC Pitfund provisioning${dryRun ? ' (dry run: reads only)' : ''}`)

  heading('1/5 Supabase')
  await provisionSupabase()

  heading('2/5 Vercel')
  await provisionVercel()

  heading('3/5 Resend')
  await provisionResend()

  heading('4/5 Sentry')
  await provisionSentry()

  heading('5/5 Supabase auth (staging hook through the Vercel bypass)')
  if (getValue('VERCEL_AUTOMATION_BYPASS_SECRET')) {
    process.argv.push('--auth-only')
    await provisionSupabase()
  }

  if (!report.waiting.length && !dryRun) {
    console.log('\nEverything that can be automated is done. Next: `npm run provision:verify`.')
  }
}

main().then(
  () => finish('provision'),
  (e) => finish('provision', e),
)
