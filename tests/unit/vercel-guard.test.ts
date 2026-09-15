import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { V1_DENY } from '../../scripts/provision/lib'

/*
 * The repository is still connected to the v1 Vercel project, which must never get a v2 deployment. Vercel runs
 * vercel.json's `ignoreCommand` from the commit it deploys: exit 0 skips the deployment, anything else builds it.
 */

const GUARD = 'scripts/vercel-ignore-build.mjs'

function guard(projectId?: string) {
  const env = { ...process.env }
  delete env.VERCEL_PROJECT_ID
  if (projectId) env.VERCEL_PROJECT_ID = projectId
  return spawnSync(process.execPath, [GUARD], { env, encoding: 'utf8' }).status
}

describe('the Vercel deployment guard', () => {
  it('is the ignored build step in vercel.json', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { ignoreCommand?: string }
    expect(config.ignoreCommand).toBe(`node ${GUARD}`)
  })

  it('skips every v1 project and any project it cannot identify, and builds a v2 project', () => {
    expect(V1_DENY.vercelProjectIds.length).toBeGreaterThan(0)
    for (const id of V1_DENY.vercelProjectIds) expect(guard(id), id).toBe(0)
    expect(guard(undefined)).toBe(0)
    expect(guard('prj_teamOwnedPitfundV2')).toBe(1)
  })

  it('knows the same v1 project ids as provisioning', () => {
    const source = readFileSync(GUARD, 'utf8')
    for (const id of V1_DENY.vercelProjectIds) expect(source).toContain(id)
  })
})
