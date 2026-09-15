/*
 * npm run db:reset [-- --scenario demo|empty|edge]
 * Local only: drop the public and drizzle schemas, restore Supabase's default grants,
 * re-apply every migration, then seed. Storage and auth users are reconciled by the seed.
 */
import postgres from 'postgres'

import { argValue, isLocalHost, loadEnv } from './lib/env'
import { runScript } from './lib/proc'

loadEnv()

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  if (!isLocalHost(url)) {
    console.error('db:reset only runs against the local stack.')
    process.exit(1)
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })
  try {
    // Dropping `public` also drops Supabase's default privileges; put them back before migrating.
    await sql.unsafe(`
      drop schema if exists drizzle cascade;
      drop schema if exists public cascade;
      create schema public authorization pg_database_owner;
      grant usage on schema public to postgres, anon, authenticated, service_role, public;
      alter default privileges in schema public grant all on tables to postgres, service_role;
      alter default privileges in schema public grant all on sequences to postgres, service_role;
      alter default privileges in schema public grant all on functions to postgres, service_role;
    `)
    console.log('✓ Dropped public and drizzle schemas')
  } finally {
    await sql.end({ timeout: 5 })
  }

  if ((await runScript('scripts/db-migrate.ts')) !== 0) process.exit(1)
  if (process.argv.includes('--no-seed')) return
  const scenario = argValue('scenario') ?? 'demo'
  process.exit(await runScript('scripts/seed/index.ts', ['--scenario', scenario]))
}

void main()
