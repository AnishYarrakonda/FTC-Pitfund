import 'server-only'

import { after } from 'next/server'

import { simulated } from '../dev'
import { drainOutbox } from './outbox'
import { TransportError, type EmailTransport } from './send'

/*
 * Actions send email after the response: `await scheduleDrain()` once the transaction commits.
 * In local development the `pitfund-simulate` cookie can make the provider fail like Resend does
 * (`email-429` rate limited, `email-500` server error) to verify the retry and "delayed" states.
 */

async function simulatedTransport(): Promise<EmailTransport | null> {
  let status: 429 | 500 | null = null
  try {
    if (await simulated('email-429')) status = 429
    else if (await simulated('email-500')) status = 500
  } catch {
    // No request (tests, scripts): nothing to simulate.
    return null
  }
  if (!status) return null
  const message = status === 429 ? 'rate_limit_exceeded: Too many requests (simulated)' : 'internal_server_error: Resend is unavailable (simulated)'
  return {
    name: 'fake',
    async send() {
      throw new TransportError(message, 'transient', status)
    },
  }
}

export async function scheduleDrain() {
  const transport = (await simulatedTransport()) ?? undefined
  try {
    after(() => drainOutbox({ transport }))
  } catch {
    // Outside a request (tests): the cron or the next action drains the outbox.
  }
}
