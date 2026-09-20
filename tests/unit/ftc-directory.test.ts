import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { getDb } from '@/lib/server/db'
import { MIN_DIRECTORY_SIZE, resetTeamIndex, suggestTeams, syncFtcDirectory } from '@/lib/server/ftc-directory'
import { lookupFtcTeam } from '@/lib/server/ftc-records'
import { ftcTeamCache } from '@/lib/server/schema'

import { createTeam, dbTest } from './helpers/db'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const credentials = { username: 'user', token: 'token' }
const NOW = new Date('2026-10-01T12:00:00Z')

// 1,200 numbers no real team uses, over three pages of 500 like FIRST's (team numbers stop at 999,999).
const BASE = 950_000
const page = (n: number) =>
  Array.from({ length: n === 3 ? 200 : 500 }, (_, i) => {
    const number = BASE + (n - 1) * 500 + i
    return { teamNumber: number, nameShort: i === 0 && n === 1 ? 'Zyxwvutsrq Robotics' : `Bot ${number}`, nameFull: i === 0 && n === 1 ? 'Qwerty Academy of Zyx' : `Bot ${number}`, city: 'Austin', stateProv: 'TX', country: 'USA' }
  })

const firstApi = (pageTotal = 3) =>
  (async (url: string | URL | Request) => {
    const n = Number(new URL(String(url)).searchParams.get('page'))
    return json({ teams: page(n), pageCurrent: n, pageTotal })
  }) as typeof fetch

afterEach(() => resetTeamIndex())

describe('FIRST team directory', () => {
  it(
    'copies every page into the cache, then serves lookups and suggestions from it',
    dbTest(async () => {
      const result = await syncFtcDirectory({ fetch: firstApi(), now: NOW, credentials })
      expect(result).toEqual({ season: 2026, teams: 1200, pages: 3 })

      const [row] = await getDb().select().from(ftcTeamCache).where(eq(ftcTeamCache.number, BASE))
      expect(row).toMatchObject({ name: 'Zyxwvutsrq Robotics', fullName: 'Qwerty Academy of Zyx', city: 'Austin', state: 'TX', source: 'first' })
      // A long name equal to the short one isn't stored twice.
      expect((await getDb().select().from(ftcTeamCache).where(eq(ftcTeamCache.number, BASE + 1)))[0].fullName).toBeNull()

      // Running it again updates rows rather than failing on the primary key.
      expect((await syncFtcDirectory({ fetch: firstApi(), now: NOW, credentials })).teams).toBe(1200)

      // A synced team is found by number without asking FIRST again.
      const offline = (() => Promise.reject(new Error('must not be called'))) as typeof fetch
      expect(await lookupFtcTeam(BASE + 2, { fetch: offline, now: NOW })).toMatchObject({ status: 'found', source: 'cache', record: { number: BASE + 2 } })

      const onPitfund = await createTeam({ number: BASE })
      const byName = await suggestTeams('zyxwvutsrq')
      expect(byName[0]).toMatchObject({ number: BASE, name: 'Zyxwvutsrq Robotics', onPitfund: true })
      expect(onPitfund.number).toBe(BASE)
      expect((await suggestTeams('qwerty academy'))[0].number).toBe(BASE)
      expect((await suggestTeams(String(BASE + 1199)))).toEqual([expect.objectContaining({ number: BASE + 1199, onPitfund: false })])
      expect(await suggestTeams('qqqqxxxxzzzz')).toEqual([])
    }),
  )

  it(
    'keeps the old directory when FIRST answers with an error or too few teams',
    dbTest(async () => {
      await expect(syncFtcDirectory({ fetch: (async () => json({}, 500)) as typeof fetch, now: NOW, credentials })).rejects.toThrow('FIRST API responded 500')
      const short = (async () => json({ teams: page(3), pageCurrent: 1, pageTotal: 1 })) as typeof fetch
      await expect(syncFtcDirectory({ fetch: short, now: NOW, credentials })).rejects.toThrow(`only 200 teams`)
      expect(await getDb().select().from(ftcTeamCache).where(inArray(ftcTeamCache.number, [BASE, BASE + 1]))).toHaveLength(0)
      expect(MIN_DIRECTORY_SIZE).toBeGreaterThan(200)
    }),
  )
})
