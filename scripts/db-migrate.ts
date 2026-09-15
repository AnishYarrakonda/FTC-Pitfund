import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { guardTarget, hostOf, loadEnv } from './lib/env'

loadEnv()

export async function runMigrations(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set. Run `npm run setup`.')
  guardTarget(url, 'apply migrations')
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
  try {
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle', migrationsSchema: 'drizzle' })
    console.log(`✓ Migrations applied to ${hostOf(url)}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
