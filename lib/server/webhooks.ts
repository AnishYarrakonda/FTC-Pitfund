import 'server-only'

import { Webhook } from 'standardwebhooks'

/**
 * Verify a Standard Webhooks signature (Supabase auth hooks, and Resend's Svix-signed
 * webhooks, which use the same scheme with `svix-*` header names). Returns the parsed JSON,
 * or null when the signature, timestamp or body is invalid.
 */
export function verifyWebhook<T>(secret: string | undefined, body: string, headers: Headers): T | null {
  if (!secret) return null
  const key = secret.replace(/^v1,/, '').replace(/^whsec_/, '')
  const pick = (name: string) => headers.get(`webhook-${name}`) ?? headers.get(`svix-${name}`) ?? ''
  try {
    return new Webhook(key).verify(body, {
      'webhook-id': pick('id'),
      'webhook-timestamp': pick('timestamp'),
      'webhook-signature': pick('signature'),
    }) as T
  } catch {
    return null
  }
}
