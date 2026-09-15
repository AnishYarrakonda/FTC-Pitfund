/*
 * npm run prod -- <task> [args] [--staging]
 *
 * Runs an operations script against the hosted database, using the values `npm run provision`
 * saved in .env.provision (so nobody copies connection strings by hand):
 *
 *   npm run prod -- backup                         pg_dump + storage listing into backups/
 *   npm run prod -- admin someone@example.com      make an existing user an admin
 *   npm run prod -- admin someone@example.com --revoke
 *
 * Production by default; `--staging` targets the staging project. Scripts still print the host
 * they're about to touch.
 */
import { runScript } from './lib/proc'
import { getValue } from './provision/lib'

const TASKS: Record<string, string> = {
  backup: 'scripts/db-backup.ts',
  admin: 'scripts/admin-grant.ts',
}

async function main() {
  const [task, ...rest] = process.argv.slice(2)
  const script = task ? TASKS[task] : undefined
  if (!script) {
    console.error(`Usage: npm run prod -- ${Object.keys(TASKS).join('|')} [args] [--staging]`)
    process.exit(1)
  }
  const stage = rest.includes('--staging') ? 'STAGING' : 'PRODUCTION'
  const args = rest.filter((a) => a !== '--staging')
  const value = (name: string) => {
    const v = getValue(`SUPABASE_${stage}_${name}`)
    if (!v) {
      console.error(`SUPABASE_${stage}_${name} isn't in .env.provision. Run \`npm run provision:supabase\` first.`)
      process.exit(1)
    }
    return v
  }
  const code = await runScript(script, [...args, '--remote'], {
    ...process.env,
    // The session pooler (port 5432) supports pg_dump and prepared statements.
    DATABASE_URL: value('SESSION_DATABASE_URL'),
    NEXT_PUBLIC_SUPABASE_URL: value('URL'),
    SUPABASE_SECRET_KEY: value('SECRET_KEY'),
    CONFIRM_REMOTE: '1',
  })
  process.exit(code)
}

void main()
