/*
 * npm run admin:grant -- someone@example.com [--revoke] [--remote]
 *
 * Makes an existing FTC Pitfund user an admin (or removes admin with --revoke). The person
 * must have signed in once so their users row exists. Audited. Remote targets also need
 * CONFIRM_REMOTE=1.
 */
import { sql } from 'drizzle-orm'

import { closeDb, getDb } from '@/lib/server/db'
import { auditEvents, users } from '@/lib/server/schema'

import { guardTarget, loadEnv } from './lib/env'

loadEnv()

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith('--'))?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    console.error('Usage: npm run admin:grant -- someone@example.com [--revoke] [--remote]')
    process.exit(1)
  }
  guardTarget(process.env.DATABASE_URL ?? '', `change admin access for ${email}`)
  const revoke = process.argv.includes('--revoke')

  const rows = await getDb()
    .update(users)
    .set({ isAdmin: !revoke })
    .where(sql`lower(${users.email}) = ${email}`)
    .returning({ id: users.id, name: users.name })
  if (!rows[0]) {
    console.error(`No FTC Pitfund user with email ${email}. They need to sign in once first.`)
    process.exit(1)
  }
  await getDb().insert(auditEvents).values({
    actorId: null,
    action: revoke ? 'user.admin_revoked' : 'user.admin_granted',
    entityType: 'user',
    entityId: rows[0].id,
    data: { via: 'cli' },
  })
  console.log(`✓ ${email} ${revoke ? 'is no longer an admin' : 'is now an admin'}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => closeDb())
