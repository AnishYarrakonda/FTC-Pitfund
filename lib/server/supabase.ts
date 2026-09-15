import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from './env'

/**
 * Cookie-bound client for auth only (read the session, send/verify codes, OAuth exchange).
 * Data never goes through Supabase REST: tables have RLS with no policies. The service-role
 * client lives in ./supabase-admin.ts.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = env()
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component render, where cookies are read-only. proxy.ts
          // refreshes the session on every request, so this is safe to ignore.
        }
      },
    },
  })
}
