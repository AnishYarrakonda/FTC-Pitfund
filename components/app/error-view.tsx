'use client'

import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { captureClientException } from '@/lib/client/sentry'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

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
        <Button data-action-button="" loading={retrying} loadingLabel="Trying again…" onClick={() => startRetry(() => retry())}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
        <Button asChild variant="secondary">
          <Link href={homeHref}>Go home</Link>
        </Button>
      </div>
      {reference ? (
        <p className="text-small text-text-tertiary">
          If it keeps happening, email {SUPPORT_EMAIL} with reference <span className="font-mono text-text-secondary">{reference}</span>.
        </p>
      ) : null}
    </div>
  )
}
