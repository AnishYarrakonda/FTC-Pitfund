import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

/*
 * Cursor (keyset) pagination for admin lists (plan §9: cursor on a sort key + id, 25 per page).
 * A cursor is the sort key of the first or last row on a page, base64url-encoded; an edited or
 * stale cursor simply starts from the beginning.
 */

const PAGE_SIZE = 25

export type PageParams = { after: string | null; before: string | null }
export type Page<T> = { items: T[]; nextCursor: string | null; prevCursor: string | null }

function encodeCursor(values: Array<string | number>): string {
  return Buffer.from(JSON.stringify(values.map(String))).toString('base64url')
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/
const INTEGER = /^-?\d{1,15}$/

/** Does `value` have the shape Postgres will accept for this cast? A cursor that doesn't must not reach the query. */
function fitsCast(cast: string, value: string) {
  if (value.includes('\u0000')) return false
  if (cast.includes('uuid')) return UUID.test(value)
  if (cast.includes('timestamp')) {
    const m = TIMESTAMP.exec(value)
    return Boolean(m) && +m![2] >= 1 && +m![2] <= 12 && +m![3] >= 1 && +m![3] <= 31 && +m![4] <= 23 && +m![5] <= 59 && +m![6] <= 59
  }
  if (cast.includes('int')) return INTEGER.test(value)
  return true
}

function decodeCursor(value: string | null, casts: string[]): string[] | null {
  if (!value || value.length > 1000) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (Array.isArray(parsed) && parsed.length === casts.length && parsed.every((p, i) => typeof p === 'string' && fitsCast(casts[i], p))) return parsed
  } catch {
    // Start from the beginning.
  }
  return null
}

/**
 * Build the cursor condition and ordering for a key (a row-value SQL expression like
 * `(submitted_at, id)`) in `direction`, plus a function that turns the fetched rows into a page.
 * `cast` renders each cursor value with its SQL type, e.g. [`::timestamptz`, `::uuid`].
 */
export function keyset<Row>(options: {
  key: SQL
  columns: SQL[]
  direction: 'asc' | 'desc'
  params: PageParams
  casts: string[]
  cursorOf: (row: Row) => Array<string | number>
}) {
  const { key, columns, direction, params, casts, cursorOf } = options
  const after = decodeCursor(params.after, casts)
  const before = after ? null : decodeCursor(params.before, casts)
  const value = (parts: string[]) => sql`(${sql.join(parts.map((p, i) => sql`${p}${sql.raw(casts[i])}`), sql`, `)})`
  const forward = direction === 'asc' ? '>' : '<'
  const backward = direction === 'asc' ? '<' : '>'
  const condition = after ? sql`${key} ${sql.raw(forward)} ${value(after)}` : before ? sql`${key} ${sql.raw(backward)} ${value(before)}` : undefined
  // Walking backwards reads the previous page in reverse order, then flips it.
  const reverse = Boolean(before)
  const dir = (direction === 'asc') !== reverse ? 'asc' : 'desc'
  const orderBy = columns.map((c) => sql`${c} ${sql.raw(dir)}`)

  function page<R extends Row>(rows: R[]): Page<R> {
    const more = rows.length > PAGE_SIZE
    const items = rows.slice(0, PAGE_SIZE)
    if (reverse) items.reverse()
    const first = items[0]
    const last = items[items.length - 1]
    return {
      items,
      nextCursor: last && (reverse ? true : more) ? encodeCursor(cursorOf(last)) : null,
      prevCursor: first && (reverse ? more : Boolean(after)) ? encodeCursor(cursorOf(first)) : null,
    }
  }

  return { condition, orderBy, limit: PAGE_SIZE + 1, page }
}
