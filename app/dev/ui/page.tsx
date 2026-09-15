import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'

import { PublicHeader } from '@/components/app/public-chrome'
import { SkeletonList } from '@/components/ui/feedback'
import { assertDevTools, sampleDeck } from '@/lib/server/dev'

import { Gallery } from './gallery'

export const metadata: Metadata = { title: 'Component gallery', robots: { index: false } }

/**
 * /dev/ui: every component in every state (plan §10), including 5,000-character unbroken
 * strings, every overlay size and ActionButtons wired to slow and failing fake actions.
 * The QA harness clicks every [data-action-button] and opens every [data-qa-overlay] trigger.
 */
export default function GalleryPage() {
  assertDevTools()
  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader
        action={
          <a href="/dev" className="text-body font-medium text-accent hover:text-accent-hover">
            Dev tools
          </a>
        }
      />
      <Suspense fallback={<SkeletonList rows={8} className="mx-auto mt-10 max-w-app" />}>
        <GalleryWithData />
      </Suspense>
    </div>
  )
}

async function GalleryWithData() {
  await connection()
  const deck = await sampleDeck().catch(() => null)
  return <Gallery deck={deck} />
}
