import { PROD_URL } from '../support/env'
import { expect, test } from '../support/fixtures'

/*
 * Regression test for percent-encoded paths with literal `%` characters.
 *
 * CONFIRMED: A non-decodable `%` in a dynamic segment — e.g. /invite/a%25b or /t/%25FF —
 * was causing a Next.js framework-level crash (DecodeError: "failed to decode param", error
 * code E528). The routing layer performs a second decodeURIComponent on the matched segment
 * (%25FF → %FF → decodeURIComponent('%FF') throws), which surfaced as HTTP 500 in production
 * and noisy console errors with a 404 in development.
 *
 * Root cause: The crash is in Next's own route-matcher (route-matcher.js), not in the app's
 * parseNumber() / safeDecode() helpers. The fix intercepts malformed URLs in proxy.ts —
 * before Next's routing layer runs — and returns 400 Bad Request, which is the correct HTTP
 * response for a syntactically invalid URL.
 *
 * Tests use request.get() (not page.goto()) to check status without routing through the
 * problems watcher, whose response listener captures any 4xx as a problem.
 */

// ─── /t/[number] ─────────────────────────────────────────────────────────────

test('/t/%25FF — proxy rejects with 400, not 500 (no route-matcher crash)', async ({ request }) => {
  // Before the fix this was a 500 in production (DecodeError in the route-matcher) and a
  // noisy 404 with console errors in dev. After the fix proxy.ts rejects it with 400.
  const response = await request.get('/t/%25FF')
  expect(response.status()).toBe(400)
})

test('/t/%25FF — production build does not crash (no 500)', async ({ request }) => {
  // Production build also used to crash. Proxy runs before the production route handler.
  const response = await request.get(`${PROD_URL}/t/%25FF`)
  expect(response.status()).toBe(400)
})

// ─── /invite/[token] ─────────────────────────────────────────────────────────

test('/invite/a%25b — proxy rejects with 400, not 500 (no route-matcher crash)', async ({ request }) => {
  // The invite token a%25b decodes to a%b which is not a valid percent sequence, causing the
  // same route-matcher crash. proxy.ts now rejects it with 400.
  const response = await request.get('/invite/a%25b')
  expect(response.status()).toBe(400)
})

test('/invite/a%25b — production build does not crash (no 500)', async ({ request }) => {
  const response = await request.get(`${PROD_URL}/invite/a%25b`)
  expect(response.status()).toBe(400)
})

// ─── Well-formed paths are not affected ──────────────────────────────────────

test('a normal /t/[number] URL still works correctly', async ({ page, problems }) => {
  // Sanity check: the fix in proxy.ts must not break valid team pages.
  const response = await page.goto('/t/31579')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Exodius' })).toBeVisible()
  expect(problems).toEqual([])
})

test('a percent-encoded char that is valid UTF-8 is passed through (not rejected)', async ({ request }) => {
  // %C3%A9 is é (e with acute accent) — a valid two-byte UTF-8 sequence.
  // The proxy must not reject it; a team with that number doesn't exist → 404.
  const response = await request.get('/t/%C3%A9')
  expect(response.status()).toBe(404)
})

test('a valid invite token with only safe chars is passed through', async ({ request }) => {
  // A realistic invite token — no percent-encoding at all — must not be rejected.
  const response = await request.get('/invite/abc123-xyz')
  // The token doesn't exist, so it renders the "not valid" page with 200 (invite page is not a 404).
  expect(response.status()).toBe(200)
})
