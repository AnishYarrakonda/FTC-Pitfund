import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { config } from 'dotenv'

/** Load .env.local (then .env) the way Next does, without overriding the real environment. */
export function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), file)
    if (existsSync(path)) config({ path, quiet: true })
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname
  } catch {
    return ''
  }
}

export function isLocalHost(url: string) {
  const host = hostOf(url)
  return host === '127.0.0.1' || host === 'localhost'
}

/**
 * Scripts that write data refuse anything but the local stack unless the caller passes
 * `--remote` AND sets CONFIRM_REMOTE=1. Returns true when the target is remote.
 */
export function guardTarget(url: string, what: string): boolean {
  if (isLocalHost(url)) return false
  const remoteFlag = process.argv.includes('--remote')
  if (!remoteFlag || process.env.CONFIRM_REMOTE !== '1') {
    console.error(
      `Refusing to ${what} on non-local host "${hostOf(url)}".\n` +
        `Pass --remote and set CONFIRM_REMOTE=1 if you really mean it.`,
    )
    process.exit(1)
  }
  console.warn(`⚠ ${what} on REMOTE host ${hostOf(url)}`)
  return true
}

export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1) return process.argv[i + 1]
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`))
  return eq?.slice(name.length + 3)
}
