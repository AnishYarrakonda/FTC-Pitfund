'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

import { captureClientException } from '@/lib/client/sentry'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

// Error boundaries load with every route, so this view avoids the Button component (Radix Slot,
// tailwind-merge) and the icon library: same look as buttonVariants md primary / secondary.
const BUTTON =
  'inline-flex h-9 shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 text-body font-medium transition-[background-color,border-color,color] duration-120 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const PRIMARY = `${BUTTON} bg-accent text-white hover:bg-accent-hover aria-busy:bg-accent/45`
const SECONDARY = `${BUTTON} border border-border-strong bg-surface text-text hover:bg-muted`

/**
 * Segment error boundary UI (plan §8): a short message, Try again, and a reference id the
 * person can quote to support. Server errors carry Next's digest; client errors get a Sentry id.
 */
export function ErrorView({ error, retry, homeHref = '/' }: { error: Error & { digest?: string }; retry: () => void; homeHref?: string }) {
  const [reference, setReference] = useState<string | null>(error.digest ?? null)
  const [retrying, startRetry] = useTransition()
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false

  useEffect(() => {
    let current = true
    void captureClientException(error).then((id) => {
      if (current && !error.digest) setReference(id)
    })
    console.error(error)
    return () => {
      current = false
    }
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-form flex-col items-start gap-5 px-4 py-16 sm:px-6 sm:py-24" role="alert">
      <div className="grid gap-2">
        <h1 className="text-h2 font-semibold tracking-tighter text-text">
          {offline ? "Couldn't reach FTC Pitfund" : 'This page didn’t load'}
        </h1>
        <p className="text-lead text-text-secondary">
          {offline
            ? 'Check your connection, then try again.'
            : 'Something went wrong on our side. Trying again usually fixes it. Nothing you entered was lost.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-action-button=""
          aria-busy={retrying || undefined}
          className={PRIMARY}
          onClick={() => {
            if (!retrying) startRetry(() => retry())
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className={`size-4 ${retrying ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {retrying ? 'Trying again…' : 'Try again'}
        </button>
        <Link href={homeHref} className={SECONDARY}>
          Go home
        </Link>
      </div>
      {reference ? (
        <p className="text-small text-text-tertiary">
          If it keeps happening, email {SUPPORT_EMAIL} with reference <span className="font-mono text-text-secondary">{reference}</span>.
        </p>
      ) : null}
    </div>
  )
}
