import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

import { PublicFooter, PublicHeader } from './public-chrome'

/**
 * Shared reading layout for the legal pages. Children are plain `<section>`, `<h2>`, `<h3>`, `<p>`,
 * `<ul>` and `<a>` elements; the typography comes from here so the pages stay free of classes.
 */
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <PublicHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
      <main id="main" className="mx-auto w-full max-w-reading flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="grid gap-3 border-b border-border pb-8">
          <h1 className="text-h1 font-semibold tracking-tighter text-text">{title}</h1>
          <p className="text-small text-text-tertiary">Last updated {updated}</p>
          {intro ? <div className="text-lead text-text-secondary">{intro}</div> : null}
        </header>
        <div
          className={[
            'grid gap-10 pt-10 text-body text-text-secondary sm:text-lead',
            '[&_section]:grid [&_section]:min-w-0 [&_section]:gap-3',
            '[&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-text',
            '[&_h3]:pt-2 [&_h3]:text-body [&_h3]:font-semibold [&_h3]:text-text sm:[&_h3]:text-lead',
            '[&_strong]:font-medium [&_strong]:text-text [&_code]:rounded-control [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[0.9em] [&_code]:text-text',
            '[&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5 [&_li]:pl-1 [&_li]:marker:text-text-tertiary',
            '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-accent-hover',
          ].join(' ')}
        >
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
