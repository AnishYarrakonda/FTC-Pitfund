import { connection } from 'next/server'

import { checkDatabase } from '@/lib/server/jobs'

/* Uptime check: the app answers and the database responds. */
export async function GET() {
  await connection()
  const db = await checkDatabase()
  return Response.json(
    { ok: db.ok, db: db.ok ? 'up' : 'down', latencyMs: db.latencyMs },
    { status: db.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
