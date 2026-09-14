import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/menu'
import { Toaster } from '@/components/ui/toaster'
import { PRODUCT_NAME } from '@/lib/shared/brand'

import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: 'Sponsorship pitches companies actually read. FTC teams pitch companies that already sponsor robotics, and a real person checks every pitch.',
  applicationName: PRODUCT_NAME,
  robots: { index: true, follow: true },
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
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  )
}
