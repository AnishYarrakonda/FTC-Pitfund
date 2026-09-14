'use client'

import { useEffect } from 'react'

import { captureClientException } from '@/lib/client/sentry'

import './globals.css'

/* Last-resort boundary when the root layout itself fails. Keeps to plain markup and tokens. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    void captureClientException(error)
  }, [error])
  return (
    <html lang="en">
      <body className="min-h-dvh bg-canvas font-sans text-text">
        <main className="mx-auto grid max-w-form gap-5 px-6 py-24" role="alert">
          <h1 className="text-h2 font-semibold tracking-tighter">FTC Pitfund didn’t load</h1>
          <p className="text-lead text-text-secondary">Something went wrong on our side. Try again in a moment.</p>
          <div>
            <button type="button" onClick={() => retry()} className="h-9 rounded-control bg-accent px-4 text-body font-medium text-white hover:bg-accent-hover">
              Try again
            </button>
          </div>
          {error.digest ? <p className="text-small text-text-tertiary">Reference {error.digest}</p> : null}
        </main>
      </body>
    </html>
  )
}
