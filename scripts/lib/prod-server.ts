import { spawn, type ChildProcess } from 'node:child_process'

/*
 * The local production server (:3100) for scripts that need real bundles and timings. When
 * nothing answers, scripts/serve-prod.ts is started: it rebuilds if the source is newer than the
 * build, then runs `next start`. Returns the child to stop afterwards, or null if one was running.
 */

async function serverUp(baseUrl: string) {
  try {
    return (await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) })).ok
  } catch {
    return false
  }
}

export async function waitForServer(baseUrl: string, seconds = 600) {
  for (let i = 0; i < seconds; i++) {
    if (await serverUp(baseUrl)) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}

export async function ensureProdServer(baseUrl = 'http://127.0.0.1:3100'): Promise<ChildProcess | null> {
  if (await serverUp(baseUrl)) return null
  console.log('▸ Starting the local production server (:3100)')
  const child = spawn(process.execPath, ['--import', 'tsx', '--import', './scripts/lib/server-only-stub.mjs', 'scripts/serve-prod.ts'], {
    stdio: 'inherit',
    detached: true,
  })
  if (await waitForServer(baseUrl)) return child
  stopServer(child)
  throw new Error('The production server did not start.')
}

/** Stops a server started above, including the `next start` it spawned. */
export function stopServer(child: ChildProcess | null) {
  if (!child?.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill()
  }
}
