'use client'

import { createBrowserClient } from '@supabase/ssr'

/** Browser client. Used only to start Google OAuth (PKCE) and for signed uploads. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
