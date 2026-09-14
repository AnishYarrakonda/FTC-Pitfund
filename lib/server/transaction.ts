import 'server-only'

import { transaction } from './db'

/**
 * Run data functions and their audit/notify writes atomically. Actions use this instead of
 * importing the database: it exposes no query handle, only the boundary. Data functions
 * inside pick up the transaction automatically (lib/server/db.ts `getDb()`).
 */
export function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
  return transaction(() => fn())
}
