/* Mailpit (local email) API helpers: every email the app sends locally lands there. */

const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

export type MailpitMessage = { ID: string; Subject: string; Created: string; To: Array<{ Address: string }>; Snippet: string }

export async function messagesTo(email: string): Promise<MailpitMessage[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=50`)
  if (!res.ok) throw new Error(`Mailpit search failed: ${res.status}`)
  const json = (await res.json()) as { messages: MailpitMessage[] }
  return json.messages ?? []
}

/** Wait for the newest sign-in code sent to `email` after `since` (ms epoch). */
export async function waitForLoginCode(email: string, { since = 0, timeoutMs = 20_000 } = {}): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const fresh = (await messagesTo(email)).filter((m) => new Date(m.Created).getTime() >= since - 1000)
    const code = fresh[0]?.Subject.match(/\b(\d{6})\b/)?.[1]
    if (code) return code
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`No sign-in code reached ${email} within ${timeoutMs} ms`)
}

export async function deleteMessagesTo(email: string) {
  const ids = (await messagesTo(email)).map((m) => m.ID)
  if (ids.length === 0) return
  await fetch(`${MAILPIT}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  })
}
