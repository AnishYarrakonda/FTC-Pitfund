import { connection } from 'next/server'

import { env } from '@/lib/server/env'
import { runDailyCron } from '@/lib/server/jobs'

/* The one Vercel Hobby cron (vercel.json, 0 13 * * *). Jobs live in lib/server/jobs.ts. */

export const maxDuration = 300

export async function GET(request: Request) {
  await connection()
  const secret = env().CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { ok, results } = await runDailyCron()
  return Response.json({ ok, results }, { status: ok ? 200 : 500 })
}
