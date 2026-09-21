/* Sign-in helpers the sign-in page uses in the browser. No zod here: keep the page's bundle small. */

/** What a visitor chose on the landing page ("I coach a team" / "I represent a company"). */
export type SignInIntent = 'team' | 'company'

export function parseIntent(value: unknown): SignInIntent | null {
  return value === 'team' || value === 'company' ? value : null
}

/** Only same-site relative paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  // The URL parser deletes tab, CR and LF anywhere in the input, so "/<TAB>/host" is really "//host".
  // No legitimate destination contains a control character or a backslash.
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return null
  if (next.startsWith('/login') || next.startsWith('/auth/') || next.startsWith('/api/')) return null
  return next
}
