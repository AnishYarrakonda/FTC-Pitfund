/*
 * A local production server for tests (port 3100 by default): builds first when the build is
 * missing or older than the source, then runs `next start`. Used by the QA harness (real
 * performance and no dev overlay) and by the E2E check that /dev 404s in production.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { runInherit } from './lib/proc'

const PORT = process.env.PORT ?? '3100'
const SOURCES = ['app', 'components', 'lib', 'proxy.ts', 'next.config.ts', 'instrumentation.ts', 'instrumentation-client.ts', 'package-lock.json']

function newestMtime(path: string): number {
  if (!existsSync(path)) return 0
  const stat = statSync(path)
  if (!stat.isDirectory()) return stat.mtimeMs
  return readdirSync(path).reduce((max, entry) => Math.max(max, newestMtime(join(path, entry))), stat.mtimeMs)
}

async function main() {
  const buildId = '.next/BUILD_ID'
  const builtAt = existsSync(buildId) ? statSync(buildId).mtimeMs : 0
  const changedAt = Math.max(...SOURCES.map(newestMtime))
  if (!builtAt || changedAt > builtAt || process.argv.includes('--rebuild')) {
    console.log('▸ Building for the local production server')
    const code = await runInherit('npx', ['next', 'build'])
    if (code !== 0) process.exit(code)
  } else {
    console.log('▸ Build is up to date')
  }
  const code = await runInherit('npx', ['next', 'start', '-H', '127.0.0.1', '-p', PORT])
  process.exit(code)
}

void main()
