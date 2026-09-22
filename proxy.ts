import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/*
 * Refreshes the Supabase session cookie on every page request and does nothing else: no
 * redirects, no role logic. Route guards live in segment layouts and lib/server/authz.ts.
 * It also forwards the requested path as `x-pathname`, so a guard can send someone to
 * /login?next=… and back.
 *
 * One guard that does live here: malformed percent-encoding. A URL like /t/%25FF reaches
 * proxy with the raw path still intact. When Next's routing layer later calls
 * decodeURIComponent('%FF') (the result of decoding %25 → %) it throws a DecodeError that
 * surfaces as a 500. Detecting it here and returning 400 is not authorization — it is URL
 * normalization that prevents a framework crash before routing happens.
 */

/**
 * Returns true when any path segment, after the browser-level URL decoding that happened
 * before proxy runs, still contains a percent sequence that Next's route-matcher cannot
 * decode — e.g. /t/%25FF arrives here as /t/%25FF; decoding %25 gives %FF; the route-matcher
 * then calls decodeURIComponent('%FF') which throws (DecodeError → 500).
 *
 * We detect this by: for each raw segment, decode it once (what URL parsing does), then check
 * whether the decoded result contains a `%XX` sequence that would itself fail decodeURIComponent.
 */
function hasMalformedEncoding(request: NextRequest): boolean {
  const rawPath = new URL(request.url).pathname
  return rawPath.split('/').some((rawSegment) => {
    // Step 1: perform the same initial decode that Next does when it parses the URL.
    let decoded: string
    try {
      decoded = decodeURIComponent(rawSegment)
    } catch {
      // The raw segment itself is already undecodable — reject it too.
      return true
    }
    // Step 2: check whether the decoded string still contains a % that would fail
    // the route-matcher's own decodeURIComponent call.
    if (!decoded.includes('%')) return false
    try {
      decodeURIComponent(decoded)
      return false
    } catch {
      return true
    }
  })
}

export async function proxy(request: NextRequest) {
  // Reject URLs with malformed percent-encoding before Next's route-matcher runs.
  // Sequences like %25FF decode to %FF, which decodeURIComponent then throws on (DecodeError →
  // 500). A 400 Bad Request is the correct response for a syntactically invalid URL.
  if (hasMalformedEncoding(request)) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const forward = () => {
    const headers = new Headers(request.headers)
    headers.set('x-pathname', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.next({ request: { headers } })
  }
  let response = forward()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = forward()
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [header, value] of Object.entries(headers ?? {})) response.headers.set(header, value)
      },
    },
  })

  // Validates the JWT and refreshes it when it is close to expiry.
  await supabase.auth.getClaims()

  return response
}

export const config = {
  matcher: [
    // Pages only: skip static assets, images, API routes (hook/webhooks/cron) and metadata files.
    '/((?!_next/static|_next/image|api/|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|txt|mjs)$).*)',
  ],
}
