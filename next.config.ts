import { withSentryConfig } from '@sentry/nextjs/config'
import { withBotId } from 'botid/next/config'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

const supabaseUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321')
  } catch {
    return new URL('http://127.0.0.1:54321')
  }
})()

/*
 * This URL is baked into the deployment: it pins the CSP below and the image optimizer's allowed hosts,
 * and it is only ever read at build time. Falling back to the local stack is right on this machine and
 * catastrophic on Vercel — the build stays green and every deployed page then blocks its own Supabase
 * calls (sign-in, uploads) and 404s every logo. Nothing else would have told us: it is not a crash, a
 * type error or a failing request during the build. So on Vercel a local URL is a build failure.
 */
if (process.env.VERCEL && ['127.0.0.1', 'localhost', ''].includes(supabaseUrl.hostname)) {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL must be the hosted Supabase URL when building on Vercel; got ${
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(unset)'
    }. Set it on the Production and Preview environments (npm run provision:vercel does this).`,
  )
}

/*
 * Content-Security-Policy. Inline scripts are allowed because App Router streams inline
 * bootstrap scripts; everything else is pinned to the origins the product actually uses:
 * Supabase (auth, storage), Google (avatars), Sentry (errors) and Vercel BotID (same-origin
 * rewrites plus vercel.live in previews).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl.origin} https://lh3.googleusercontent.com`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl.origin} https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vercel.live${isDev ? ' ws: http://127.0.0.1:* http://localhost:*' : ''}`,
  "worker-src 'self' blob:",
  `frame-src 'self' ${supabaseUrl.origin} https://vercel.live`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev || supabaseUrl.protocol === 'http:' ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
]

const nextConfig: NextConfig = {
  /*
   * `next build` type-checks the whole tsconfig, and Vercel builds from an upload that .vercelignore has
   * already stripped: no /tests, /docs, /prompts, /qa. The test harness stayed in the root set, so five
   * scripts and both Playwright configs failed to resolve `../tests/...` and every deployment errored with
   * TS2307 — a failure no local build or CI run could reproduce, because both have those files on disk.
   * The build checks what is deployed; `npm run typecheck` still checks everything, scripts and tests
   * included. Excluding a directory only drops it from the root set, so anything the app really imports
   * is still type-checked through that import.
   */
  typescript: { tsconfigPath: 'tsconfig.build.json' },
  cacheComponents: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The stylesheet (~13 KB gzipped, Tailwind) arrives inside the HTML instead of as a render-blocking request that
    // competes with the page's scripts: on Slow 4G that request alone held first paint on /login to ~2 s (plan §6).
    inlineCss: true,
  },
  // The local stack and the QA harness use 127.0.0.1; let dev assets load from it.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    // AVIF first: the landing page's hero screenshot is its LCP element, and AVIF is ~40% smaller than WebP.
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: '/storage/v1/object/public/**',
      },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    // Local Supabase serves from 127.0.0.1, which the optimizer refuses by default (dev and the local
    // production build used by QA); a hosted Supabase project never needs it.
    dangerouslyAllowLocalIP: ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname),
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default withSentryConfig(withBotId(nextConfig), {
  silent: true,
  telemetry: false,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
