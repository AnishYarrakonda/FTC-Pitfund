import { ArrowLeft, ArrowUpRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

import { PublicFooter, PublicHeader } from './public-chrome'

/**
 * Shared layout for the two legal pages.
 *
 * They used to be a bare reading column on white: no way back except the browser button, no sense of
 * which of the fourteen sections you were in, and nothing on the page that looked like the rest of
 * FTC Pitfund. Now they sit on the app canvas with the app's own controls — the same `← Back` link
 * the welcome pages use, a contents list, the page-header type scale — so a visitor who lands here
 * from the Google consent screen or the footer can see it is the same product.
 *
 * Sections are passed as data rather than as free children so each one gets an `id`: the contents
 * list needs them, and a stable `/legal/privacy#what-we-collect` is worth having when someone asks
 * where a particular promise is written down. Everything here is static markup — no client JS, so
 * the pages stay on the public first-load budget.
 */
export type LegalSection = { id: string; title: string; body: ReactNode }

export function LegalPage({
  title,
  updated,
  intro,
  sections,
  other,
}: {
  title: string
  updated: string
  intro: ReactNode
  sections: LegalSection[]
  /** The other legal page, offered at the end so the pair reads as one document. */
  other: { href: string; title: string; description: string }
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <PublicHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
      <main id="main" className="mx-auto w-full max-w-app flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Link
          href="/"
          className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to home
        </Link>

        <header className="mt-6 grid max-w-reading gap-4 border-b border-border pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h1 font-semibold tracking-tighter text-text">{title}</h1>
            <span className="rounded-control bg-muted px-2 py-1 text-caption font-medium text-text-secondary">Updated {updated}</span>
          </div>
          <div className="text-lead text-text-secondary">{intro}</div>
        </header>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
          <Contents sections={sections} />

          <article className="min-w-0 max-w-reading">
            <div className={[...PROSE].join(' ')}>
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-20">
                  <h2>{s.title}</h2>
                  {s.body}
                </section>
              ))}
            </div>

            <aside className="mt-12 grid gap-4 rounded-dialog border border-border bg-surface p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div className="grid gap-1">
                <p className="text-body font-medium text-text">{other.title}</p>
                <p className="text-small text-text-secondary">{other.description}</p>
              </div>
              <Button asChild variant="secondary" className="shrink-0">
                <Link href={other.href}>
                  Read it
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            </aside>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
              <p className="text-small text-text-tertiary">
                Questions about this page?{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline underline-offset-4 hover:text-accent-hover">
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <Button asChild variant="secondary" size="sm">
                <Link href="/">
                  <ArrowLeft aria-hidden="true" />
                  Back to home
                </Link>
              </Button>
            </div>
          </article>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

/**
 * The contents, in the two shapes the page needs. On a phone it is a closed `<details>` — fourteen
 * links opened by default pushed the first paragraph off the screen, which is the opposite of what a
 * contents list is for. From `lg` up there is room beside the text, so it is an open sticky rail.
 * Two renderings rather than one clever one: `<details open>` can't be forced back open with CSS.
 */
function Contents({ sections }: { sections: LegalSection[] }) {
  const links = (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 lg:grid lg:gap-2">
      {sections.map((s) => (
        <li key={s.id} className="min-w-0">
          <a href={`#${s.id}`} className="text-small text-text-secondary underline-offset-4 hover:text-text hover:underline">
            {s.title}
          </a>
        </li>
      ))}
    </ul>
  )
  return (
    <>
      <details className="group rounded-dialog border border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-dialog px-5 py-4 text-small font-medium text-text marker:content-none [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown aria-hidden="true" className="size-4 text-text-tertiary transition-transform group-open:rotate-180" />
        </summary>
        <nav aria-label="On this page" className="border-t border-border px-5 py-4">
          {links}
        </nav>
      </details>
      <nav aria-label="On this page" className="hidden lg:sticky lg:top-8 lg:block">
        <p className="mb-3 text-caption font-medium tracking-wide text-text-tertiary uppercase">On this page</p>
        {links}
      </nav>
    </>
  )
}

/** The pages write plain `<p>`, `<ul>`, `<h3>` and `<a>`; the type scale lives here. */
const PROSE = [
  'grid gap-10 text-body text-text-secondary sm:text-lead',
  '[&_section]:grid [&_section]:min-w-0 [&_section]:gap-3',
  '[&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-text',
  '[&_h3]:pt-2 [&_h3]:text-body [&_h3]:font-semibold [&_h3]:text-text sm:[&_h3]:text-lead',
  '[&_strong]:font-medium [&_strong]:text-text [&_code]:rounded-control [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[0.9em] [&_code]:text-text',
  '[&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5 [&_li]:pl-1 [&_li]:marker:text-text-tertiary',
  '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-accent-hover',
] as const
