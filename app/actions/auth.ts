'use server'

import { checkBotId } from 'botid/server'
import { redirect } from 'next/navigation'

import { AppError, defineAction } from '@/lib/server/result'
import { createSupabaseServerClient } from '@/lib/server/supabase'
import { ensureUserRow, loadViewer } from '@/lib/server/viewer'
import { codeSchema, emailSchema, safeNext } from '@/lib/shared/schemas/account'
import { signInDestination } from '@/lib/shared/viewer'

/*
 * Email-code sign-in (plan §3.2 "Sign in, email code"). Both steps run on the server so the
 * code request can be bot-checked and every Supabase error maps to one of our messages.
 */

const SEND_FAILED = "We couldn't send the email right now. Continue with Google, or try again in a few minutes."

function waitSeconds(message: string): number | null {
  const match = message.match(/after (\d+) seconds?/i)
  return match ? Number(match[1]) : null
}

export const requestLoginCode = defineAction(emailSchema, async ({ email }) => {
  const verification = await checkBotId()
  if (verification.isBot) {
    throw new AppError('FORBIDDEN', "We couldn't verify this request. Refresh the page and try again.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) {
    const seconds = waitSeconds(error.message)
    if (error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit' || seconds) {
      const wait = seconds ?? 60
      throw new AppError(
        'RATE_LIMITED',
        wait < 60 ? `Too many attempts. Try again in ${wait} seconds.` : `Too many attempts. Try again in ${Math.ceil(wait / 60)} minutes.`,
        { field: 'email' },
      )
    }
    if (error.code === 'email_address_invalid' || error.code === 'validation_failed') {
      throw new AppError('VALIDATION', 'Enter a valid email address, like name@example.com', { field: 'email' })
    }
    if (error.code === 'signup_disabled' || error.code === 'email_provider_disabled') {
      throw new AppError('UNAVAILABLE', 'Email sign-in is turned off right now. Continue with Google instead.')
    }
    console.error('[auth] signInWithOtp failed', error.status, error.code)
    throw new AppError('UNAVAILABLE', SEND_FAILED)
  }
  return { email, sentAt: Date.now() }
})

export const verifyLoginCode = defineAction(codeSchema, async ({ email, code, next }) => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error || !data.user) {
    if (error?.status === 429 || error?.code === 'over_request_rate_limit') {
      throw new AppError('RATE_LIMITED', 'Too many attempts. Try again in 5 minutes.', { field: 'code' })
    }
    // Supabase answers `otp_expired` for both a wrong and an expired code; the client
    // tells them apart from the time the code was sent.
    throw new AppError('VALIDATION', "That code isn't right. Check the latest email.", { field: 'code' })
  }

  await ensureUserRow({ sub: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata })
  const viewer = await loadViewer(data.user.id)
  return { redirectTo: signInDestination(viewer, safeNext(next)) }
})

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login?signed_out=1')
}

/** Sign out and come back to an invite link, to accept it with the invited address. */
export async function signOutForInvite(token: string) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut({ scope: 'local' })
  const next = safeNext(`/invite/${encodeURIComponent(token)}`)
  redirect(next ? `/login?next=${encodeURIComponent(next)}` : '/login')
}
