import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'

import { PRODUCT_NAME } from '@/lib/shared/brand'

import './globals.css'

// Not preloaded: text paints at once in the size-matched fallback, and the 48 KB font doesn't compete with
// the page's main image and scripts on slow connections (plan §6 LCP budget).
const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: 'Sponsorship pitches companies actually read. FTC teams pitch companies that already sponsor robotics, and a real person checks every pitch.',
  applicationName: PRODUCT_NAME,
  // No default robots tag: pages are indexable unless they opt out, and a not-found page's
  // injected `noindex` never competes with an inherited `index, follow`.
}

export const viewport: Viewport = {
  themeColor: '#fafafa',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[60] rounded-control bg-surface px-3 py-2 text-body font-medium text-text shadow-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
