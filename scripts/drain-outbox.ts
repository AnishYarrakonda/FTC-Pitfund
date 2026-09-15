/*
 * npm run email:drain [-- --remote]   Send whatever is due in the email outbox, now.
 * The same drainOutbox() the app runs after actions and in the daily cron; prints the
 * quota before and after so a delayed queue is visible.
 */
import { closeDb } from '@/lib/server/db'
import { drainOutbox, quotaUsage } from '@/lib/server/email/outbox'

import { guardTarget, loadEnv } from './lib/env'

loadEnv()

async function main() {
  guardTarget(process.env.DATABASE_URL ?? '', 'drain the email outbox')
  const before = await quotaUsage()
  console.log(`Quota before: ${before.used}/${before.limit} used in the last 24 h`)
  const result = await drainOutbox()
  console.log(`Drained: ${JSON.stringify(result)}`)
  const after = await quotaUsage()
  console.log(`Quota after:  ${after.used}/${after.limit}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => closeDb())
