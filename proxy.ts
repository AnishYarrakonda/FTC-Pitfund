import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/*
 * Refreshes the Supabase session cookie on every page request and does nothing else: no
 * redirects, no role logic. Route guards live in segment layouts and lib/server/authz.ts.
 * It also forwards the requested path as `x-pathname`, so a guard can send someone to
 * /login?next=… and back.
 */
export async function proxy(request: NextRequest) {
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
