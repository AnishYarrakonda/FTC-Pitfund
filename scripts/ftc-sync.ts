/*
 * npm run ftc:sync [-- --remote]   Copy FIRST's team list into the database, now.
 * The same syncFtcDirectory() the weekly cron job runs; the team setup page searches this copy.
 * Local by default. Needs FIRST_API_USERNAME and FIRST_API_TOKEN in .env.local.
 */
import { closeDb } from '@/lib/server/db'
import { syncFtcDirectory } from '@/lib/server/ftc-directory'

import { guardTarget, loadEnv } from './lib/env'

loadEnv()

async function main() {
  guardTarget(process.env.DATABASE_URL ?? '', 'copy the FIRST team list')
  const started = Date.now()
  const { season, teams, pages } = await syncFtcDirectory()
  console.log(`Copied ${teams} teams (season ${season}, ${pages} pages) in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => closeDb())
