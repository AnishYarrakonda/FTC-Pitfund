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
  cacheComponents: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // The local stack and the QA harness use 127.0.0.1; let dev assets load from it.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: '/storage/v1/object/public/**',
      },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
    // Local Supabase serves from 127.0.0.1, which the optimizer refuses by default.
    dangerouslyAllowLocalIP: isDev,
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
