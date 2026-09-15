import { spawn, spawnSync, type SpawnSyncOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export function supabaseBin() {
  const local = resolve(process.cwd(), 'node_modules/.bin/supabase')
  return existsSync(local) ? local : 'supabase'
}

export function run(cmd: string, args: string[], options: SpawnSyncOptions = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...options })
  return { code: result.status ?? 1, stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? '') }
}

/** Run a command with inherited stdio; resolves with its exit code. */
export function runInherit(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env })
    child.on('close', (code) => resolvePromise(code ?? 1))
  })
}

/** Run another TypeScript script the way package.json does (tsx + server-only stub). */
export function runScript(script: string, args: string[] = [], env: NodeJS.ProcessEnv = process.env) {
  return runInherit(
    process.execPath,
    ['--import', 'tsx', '--import', './scripts/lib/server-only-stub.mjs', script, ...args],
    env,
  )
}

export function parseDotenv(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let value = m[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out.set(m[1], value)
  }
  return out
}
