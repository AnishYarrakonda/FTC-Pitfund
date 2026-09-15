/*
 * npm run db:backup [-- --remote]
 *
 * Supabase's free plan has no backups. This writes a pg_dump of the database (schema + data)
 * and a listing of every storage object to backups/<timestamp>/ (gitignored: it contains real
 * user data). Uses a local pg_dump when installed, otherwise the postgres:17 Docker image.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

import { guardTarget, hostOf, loadEnv } from './lib/env'

loadEnv()

function pgDump(url: string, file: string) {
  const local = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' })
  const args = ['--no-owner', '--no-privileges', '--format=custom', '--schema=public', '--schema=auth', '--schema=drizzle']
  if (local.status === 0) {
    return spawnSync('pg_dump', [...args, `--file=${file}`, url], { stdio: 'inherit' }).status
  }
  // Inside Docker, the host's 127.0.0.1 is host.docker.internal.
  const dockerUrl = url.replace(/@(127\.0\.0\.1|localhost)([:/])/, '@host.docker.internal$2')
  const result = spawnSync('docker', ['run', '--rm', 'postgres:17', 'pg_dump', ...args, dockerUrl], { maxBuffer: 1024 * 1024 * 1024 })
  if (result.status === 0) writeFileSync(file, result.stdout)
  else process.stderr.write(result.stderr)
  return result.status
}

async function listStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return []
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage
  const out: Array<{ bucket: string; path: string; size: number | null; updated: string | null }> = []
  for (const bucket of ['public', 'staging']) {
    const walk = async (prefix: string) => {
      const { data } = await storage.from(bucket).list(prefix, { limit: 1000 })
      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.id) out.push({ bucket, path, size: (item.metadata?.size as number) ?? null, updated: item.updated_at ?? null })
        else await walk(path)
      }
    }
    await walk('')
  }
  return out
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  guardTarget(url, 'back up the database')
  const dir = `backups/${new Date().toISOString().replace(/[:.]/g, '-')}`
  mkdirSync(dir, { recursive: true })
  console.log(`▸ Dumping ${hostOf(url)} to ${dir}/database.dump`)
  if (pgDump(url, `${dir}/database.dump`) !== 0) throw new Error('pg_dump failed')
  const objects = await listStorage()
  writeFileSync(`${dir}/storage-objects.json`, JSON.stringify(objects, null, 2))
  console.log(`✓ Backup written: ${dir} (${objects.length} storage objects listed)`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
