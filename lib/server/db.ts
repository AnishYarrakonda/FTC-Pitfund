import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from './env'
import * as schema from './schema'

/*
 * The only database handle. Importable from lib/server/**, scripts/** and tests/** only
 * (enforced by ESLint). The app connects as the table owner, so RLS (enabled, zero policies)
 * never blocks it while the Supabase REST API stays locked out.
 *
 * `getDb()` returns the current transaction when called inside `transaction()` (or a test's
 * rollback wrapper), so data functions compose without threading a handle through every call.
 */

export type Database = PostgresJsDatabase<typeof schema>
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]
export type DbOrTx = Database | Tx

const globalForDb = globalThis as unknown as { __pitfundSql?: postgres.Sql; __pitfundDb?: Database }

function createClient() {
  return postgres(env().DATABASE_URL, {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: process.env.VERCEL ? 3 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  })
}

function rootDb(): Database {
  if (!globalForDb.__pitfundDb) {
    globalForDb.__pitfundSql = createClient()
    globalForDb.__pitfundDb = drizzle(globalForDb.__pitfundSql, { schema })
  }
  return globalForDb.__pitfundDb
}

const txStorage = new AsyncLocalStorage<Tx>()

export function getDb(): DbOrTx {
  return txStorage.getStore() ?? rootDb()
}

/** Run `fn` in a transaction (a savepoint when already inside one). */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const current = txStorage.getStore()
  const base = current ?? rootDb()
  return base.transaction((tx) => txStorage.run(tx, () => fn(tx)))
}

class RollbackSignal extends Error {}

/** Tests: run `fn` inside a transaction that is always rolled back. */
export async function withRollback<T>(fn: () => Promise<T>): Promise<T> {
  let result: T | undefined
  try {
    await rootDb().transaction(async (tx) => {
      result = await txStorage.run(tx, fn)
      throw new RollbackSignal()
    })
  } catch (e) {
    if (!(e instanceof RollbackSignal)) throw e
  }
  return result as T
}

/** Scripts and test teardown: close the pool so the process can exit. */
export async function closeDb() {
  await globalForDb.__pitfundSql?.end({ timeout: 5 })
  globalForDb.__pitfundSql = undefined
  globalForDb.__pitfundDb = undefined
}
