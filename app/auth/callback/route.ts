import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { createSupabaseServerClient } from '@/lib/server/supabase'
import { ensureUserRow, loadViewer } from '@/lib/server/viewer'
import { requestOrigin } from '@/lib/shared/request-origin'
import { safeNext } from '@/lib/shared/schemas/account'
import { signInDestination } from '@/lib/shared/viewer'

/*
 * Returns from Google (PKCE `code`) or an emailed link (`token_hash` + `type`), sets the
 * session cookie, then sends the person to /welcome (first time) or their home.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = requestOrigin(request)
  const next = safeNext(url.searchParams.get('next'))
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, origin), 303)

  const providerError = url.searchParams.get('error')
  if (providerError) {
    const description = url.searchParams.get('error_description') ?? ''
    const cancelled = providerError === 'access_denied' || /cancel|denied/i.test(description)
    return toLogin(cancelled ? 'google_cancelled' : 'google_failed')
  }

  const supabase = await createSupabaseServerClient()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null

  let userId: string | undefined
  let claims: Parameters<typeof ensureUserRow>[0] | undefined
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) return toLogin('google_failed')
    userId = data.user.id
    claims = { sub: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error || !data.user) return toLogin('link_expired')
    userId = data.user.id
    claims = { sub: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata }
  } else {
    return toLogin('google_failed')
  }

  await ensureUserRow(claims)
  const viewer = await loadViewer(userId)
  const destination = signInDestination(viewer, next)
  return NextResponse.redirect(new URL(destination, origin), 303)
}
