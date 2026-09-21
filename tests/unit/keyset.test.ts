import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { queryDirectory } from '@/lib/server/data/directory'
import { keyset } from '@/lib/server/data/keyset'

import { dbTest } from './helpers/db'

/*
 * Keyset cursors and search text come from the URL. A value of the wrong shape (or a NUL byte, which
 * Postgres refuses in text) used to reach the query and turn the whole page into the error screen; it
 * must start from the beginning instead, as the comment on decodeCursor promises.
 */

const b64 = (parts: unknown[]) => Buffer.from(JSON.stringify(parts)).toString('base64url')
const UUID = '2a9263ad-d350-448b-933c-50721a1083ea'

const conditionFor = (after: string | null, casts: string[]) =>
  keyset({ key: sql`(a, b)`, columns: [sql`a`, sql`b`], direction: 'desc', params: { after, before: null }, casts, cursorOf: () => [] }).condition

describe('keyset cursors', () => {
  it('accept a cursor whose parts fit their casts', () => {
    expect(conditionFor(b64(['2026-09-09 15:15:00.123+00', UUID]), ['::timestamptz', '::uuid'])).toBeDefined()
    expect(conditionFor(b64(['2026-09-09T15:15:00Z', UUID]), ['::timestamptz', '::uuid'])).toBeDefined()
    expect(conditionFor(b64(['zed', UUID]), ['::text', '::uuid'])).toBeDefined()
    expect(conditionFor(b64(['12']), ['::int'])).toBeDefined()
  })

  it('start over for anything else, instead of reaching the query', () => {
    for (const bad of [
      b64(['x', 'y']),
      b64(['\u0000', '\u0000']),
      b64(['2026-13-45 99:99:99', UUID]),
      b64(['2026-09-09 15:15:00+00', 'not-a-uuid']),
      b64(['2026-09-09 15:15:00+00']),
      b64([1, 2]),
      '!!!garbage***',
    ]) {
      expect(conditionFor(bad, ['::timestamptz', '::uuid']), bad).toBeUndefined()
    }
    expect(conditionFor(b64(['abc']), ['::int'])).toBeUndefined()
    expect(conditionFor(b64(['a\u0000b']), ['::text'])).toBeUndefined()
  })
})

describe('the sponsor directory', () => {
  it(
    'does not throw on a NUL byte in the search text or a malformed cursor',
    dbTest(async () => {
      const page = await queryDirectory({ q: 'a\u0000b', after: null, before: null })
      expect(page.items).toEqual(expect.any(Array))
      const cursor = await queryDirectory({ q: '', after: b64(['x', 'y']), before: null })
      expect(cursor.items).toEqual(expect.any(Array))
    }),
  )
})
