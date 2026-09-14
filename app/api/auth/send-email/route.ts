import { enqueueEmail, PRIORITY, sendNow } from '@/lib/server/email/outbox'
import { env } from '@/lib/server/env'
import { verifyWebhook } from '@/lib/server/webhooks'

/*
 * Supabase Auth "Send Email" hook. Supabase calls this instead of sending its own email, so
 * every sign-in code is a branded FTC Pitfund email that counts against the same quota.
 * It enqueues at priority 0 and sends synchronously: the hook has a short timeout, and a
 * code that arrives late is useless, so a failure is reported back and the login page
 * tells the person to use Google or try again.
 */

type HookPayload = {
  user: { id: string; email: string }
  email_data: {
    token: string
    token_hash: string
    email_action_type: string
    redirect_to?: string
    site_url?: string
    token_new?: string
    token_hash_new?: string
  }
}

// Action types that carry a sign-in code. Everything else (password/email/MFA notices) is
// irrelevant to a passwordless product and is acknowledged without sending.
const CODE_ACTIONS = new Set(['magiclink', 'signup', 'email', 'invite', 'reauthentication'])

const HOOK_SEND_TIMEOUT_MS = 3500

function hookError(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status })
}

export async function POST(request: Request) {
  const body = await request.text()
  const payload = verifyWebhook<HookPayload>(env().SEND_EMAIL_HOOK_SECRET, body, request.headers)
  if (!payload?.user?.email || !payload.email_data) return hookError(401, 'Invalid signature')

  const { user, email_data: data } = payload
  if (!CODE_ACTIONS.has(data.email_action_type)) return Response.json({})

  const code = data.token
  if (!/^\d{6}$/.test(code ?? '')) return hookError(400, 'Expected a 6-digit code')

  try {
    const queued = await enqueueEmail({
      to: user.email,
      template: 'login-code',
      data: { code, expiresInMinutes: 10 },
      priority: PRIORITY.auth,
      // The token hash is unique per code, so a retried hook call never sends twice.
      dedupeKey: `auth:${user.id}:${data.token_hash}`,
    })
    if (queued.deduped) return Response.json({})
    const outcome = await sendNow(queued.id, { timeoutMs: HOOK_SEND_TIMEOUT_MS })
    if (outcome !== 'sent') return hookError(503, 'Email could not be sent')
    return Response.json({})
  } catch (e) {
    console.error('[send-email hook]', e)
    return hookError(500, 'Email could not be sent')
  }
}
