import { markBounced } from '@/lib/server/email/outbox'
import { env } from '@/lib/server/env'
import { verifyWebhook } from '@/lib/server/webhooks'

/* Resend delivery events (Svix-signed). Bounces and complaints are recorded on the outbox row. */

type ResendEvent = {
  type: string
  data: { email_id?: string; bounce?: { message?: string; subType?: string } }
}

export async function POST(request: Request) {
  const body = await request.text()
  const event = verifyWebhook<ResendEvent>(env().RESEND_WEBHOOK_SECRET, body, request.headers)
  if (!event) return Response.json({ error: 'Invalid signature' }, { status: 401 })

  const emailId = event.data?.email_id
  if (!emailId) return Response.json({ ok: true, ignored: true })

  if (event.type === 'email.bounced') {
    const updated = await markBounced(emailId, 'bounced', event.data.bounce?.message ?? event.data.bounce?.subType)
    return Response.json({ ok: true, updated })
  }
  if (event.type === 'email.complained') {
    const updated = await markBounced(emailId, 'complained')
    return Response.json({ ok: true, updated })
  }
  return Response.json({ ok: true, ignored: true })
}
