import Link from 'next/link'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

import { PublicFooter, PublicHeader } from './public-chrome'

/** Shared reading layout for the legal pages. Prompt 4 finalizes the text. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <PublicHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
      <main id="main" className="mx-auto w-full max-w-reading flex-1 px-4 py-16 sm:px-6">
        <header className="grid gap-2 border-b border-border pb-8">
          <h1 className="text-h1 font-semibold tracking-tighter text-text">{title}</h1>
          <p className="text-small text-text-tertiary">Last updated {updated}</p>
        </header>
        <div className="grid gap-8 pt-8 text-body text-text-secondary [&_h2]:text-lead [&_h2]:font-semibold [&_h2]:text-text [&_li]:pl-1 [&_section]:grid [&_section]:gap-3 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2 [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
