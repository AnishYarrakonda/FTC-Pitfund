import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { getDb } from '@/lib/server/db'
import { CACHE_TTL_MS, fetchFromFirstApi, fetchFromFtcScout, lookupFtcTeam } from '@/lib/server/ftc-records'
import { ftcTeamCache } from '@/lib/server/schema'

import { dbTest } from './helpers/db'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const scoutTeam = (number: number) =>
  json({ data: { teamByNumber: { number, name: 'Exodius', location: { city: 'Austin', state: 'TX', country: 'USA' } } } })

const creds = { username: 'user', token: 'token' }
const NOW = new Date('2026-10-01T12:00:00Z')

describe('FIRST Events API', () => {
  it('uses the May-based API season and falls back to the previous season', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ teams: [] }))
      .mockResolvedValueOnce(json({ teams: [{ teamNumber: 31579, nameShort: 'Exodius', city: 'Austin', stateProv: 'TX', country: 'USA' }] }))
    const result = await fetchFromFirstApi(31579, { fetch: fetchMock, now: NOW, ...creds })
    expect(result).toEqual({ status: 'found', record: { number: 31579, name: 'Exodius', city: 'Austin', state: 'TX', country: 'USA' } })
    expect(fetchMock.mock.calls[0][0]).toContain('/2026/teams?teamNumber=31579')
    expect(fetchMock.mock.calls[1][0]).toContain('/2025/teams?teamNumber=31579')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Basic ${Buffer.from('user:token').toString('base64')}`)
  })

  it('is unavailable without credentials, on 5xx and on network errors', async () => {
    expect((await fetchFromFirstApi(1, { fetch: vi.fn(), username: '', token: '' })).status).toBe('unavailable')
    expect((await fetchFromFirstApi(1, { fetch: vi.fn().mockResolvedValue(json({}, 503)), ...creds })).status).toBe('unavailable')
    expect((await fetchFromFirstApi(1, { fetch: vi.fn().mockRejectedValue(new Error('ETIMEDOUT')), ...creds })).status).toBe('unavailable')
  })
})

describe('FTCScout', () => {
  it('reads the nested location { city state country } schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(scoutTeam(31579))
    expect(await fetchFromFtcScout(31579, { fetch: fetchMock })).toEqual({
      status: 'found',
      record: { number: 31579, name: 'Exodius', city: 'Austin', state: 'TX', country: 'USA' },
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.query).toContain('location { city state country }')
    expect(body.variables).toEqual({ number: 31579 })
  })

  it('treats GraphQL errors as unavailable, not as "no such team"', async () => {
    expect((await fetchFromFtcScout(1, { fetch: vi.fn().mockResolvedValue(json({ errors: [{ message: 'bad field' }] })) })).status).toBe('unavailable')
    expect((await fetchFromFtcScout(1, { fetch: vi.fn().mockResolvedValue(json({ data: { teamByNumber: null } })) })).status).toBe('not_found')
  })
})

describe('lookupFtcTeam', () => {
  it(
    'falls back from FIRST to FTCScout when FIRST is down, and caches the result for 30 days',
    dbTest(async () => {
      const number = 900000 + Math.floor(Math.random() * 99999)
      await getDb().delete(ftcTeamCache).where(eq(ftcTeamCache.number, number))
      const fetchMock = vi.fn(async (url: string) => (url.includes('ftc-api') ? json({}, 500) : scoutTeam(number)))
      const first = await lookupFtcTeam(number, { fetch: fetchMock as typeof fetch, now: NOW, firstCredentials: creds })
      expect(first).toMatchObject({ status: 'found', source: 'ftcscout', record: { city: 'Austin' } })

      const offline = vi.fn().mockRejectedValue(new Error('offline'))
      const cached = await lookupFtcTeam(number, { fetch: offline, now: new Date(NOW.getTime() + CACHE_TTL_MS - 1000), firstCredentials: creds })
      expect(cached).toMatchObject({ status: 'found', source: 'cache' })
      expect(offline).not.toHaveBeenCalled()

      // Past the TTL with every source down, a stale record still beats nothing.
      const stale = await lookupFtcTeam(number, { fetch: offline, now: new Date(NOW.getTime() + CACHE_TTL_MS + 1000), firstCredentials: creds })
      expect(stale).toMatchObject({ status: 'found', source: 'cache' })
    }),
  )

  it(
    'returns not_found for an authoritative miss and unavailable when every source is down',
    dbTest(async () => {
      const miss = vi.fn(async (url: string) => (url.includes('ftc-api') ? json({ teams: [] }) : scoutTeam(1)))
      expect(await lookupFtcTeam(888801, { fetch: miss as typeof fetch, now: NOW, firstCredentials: creds })).toEqual({ status: 'not_found' })

      const down = vi.fn().mockRejectedValue(new Error('offline'))
      expect((await lookupFtcTeam(888802, { fetch: down, now: NOW, firstCredentials: null })).status).toBe('unavailable')
      expect(await lookupFtcTeam(-5)).toEqual({ status: 'not_found' })
    }),
  )
})
