import type { MetadataRoute } from 'next'

import { absoluteUrl } from '@/lib/server/env'

/*
 * /robots.txt: public pages are crawlable; signed-in areas, admin, dev tools, the API and
 * invite links are not. The production smoke test checks for `Disallow: /admin`.
 */
const PRIVATE_PATHS = [
  '/admin',
  '/dev',
  '/api',
  '/invite',
  '/auth',
  '/welcome',
  '/account',
  '/pitches',
  '/sponsors',
  '/team',
  '/inbox',
  '/company',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
