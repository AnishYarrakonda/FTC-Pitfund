/**
 * The origin the browser actually used. `request.url` in `next dev` reports `localhost` even
 * when the page was opened on 127.0.0.1, and a redirect across those hosts drops the session
 * cookie that was just set, so redirects build on the Host header instead.
 */
export function requestOrigin(request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return new URL(request.url).origin
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')
  return `${proto}://${host}`
}
