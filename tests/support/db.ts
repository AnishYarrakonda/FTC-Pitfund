import postgres from 'postgres'

import { assertLocalStack, DATABASE_URL } from './env'

/* Direct SQL for E2E set-up that the UI can't reach (expiring a code, exhausting the quota). */

let sql: postgres.Sql | undefined

export function db() {
  assertLocalStack()
  sql ??= postgres(DATABASE_URL, { max: 2, prepare: false, onnotice: () => {} })
  return sql
}

export async function closeTestDb() {
  await sql?.end({ timeout: 5 })
  sql = undefined
}
