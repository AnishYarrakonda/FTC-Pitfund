import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from './env'

let adminClient: SupabaseClient | undefined

/**
 * Service-role client: Auth admin API and Storage. Bypasses everything. Server-only, never
 * exposed to the browser, importable only from lib/server/**, scripts/** and tests/** (ESLint).
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (!adminClient) {
    const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY } = env()
    adminClient = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return adminClient
}
