import { loadEnv } from '../../scripts/lib/env'

loadEnv()

export const DEV_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'
export const PROD_URL = process.env.QA_BASE_URL ?? 'http://127.0.0.1:3100'
export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'

/** Tests seed, reset and sign in with admin keys: never let them near a real project. */
export function assertLocalStack() {
  for (const url of [DATABASE_URL, SUPABASE_URL]) {
    const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname
    if (host !== '127.0.0.1' && host !== 'localhost') {
      throw new Error(`Tests only run against the local stack; ${host} is not local. Run \`npm run setup\`.`)
    }
  }
}
