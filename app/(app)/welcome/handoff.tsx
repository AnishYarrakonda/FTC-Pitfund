import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { PageContainer } from '@/components/ui/page'

/**
 * The hand-off after the role choice. Team setup (prompt 2) and company setup (prompt 3)
 * replace these pages; until then they say plainly that the step isn't open yet.
 */
export function SetupHandoff({ title, description, steps }: { title: string; description: string; steps: ReactNode[] }) {
  return (
    <PageContainer width="form" className="sm:pt-16">
      <Link href="/welcome" className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back
      </Link>
      <header className="mt-6 grid gap-2">
        <h1 className="text-h1 font-semibold tracking-tighter text-text">{title}</h1>
        <p className="text-lead text-text-secondary">{description}</p>
      </header>
      <ol className="mt-10 grid gap-0 border-t border-border">
        {steps.map((step, i) => (
          <li key={i} className="grid grid-cols-[28px_1fr] gap-3 border-b border-border py-4 text-body text-text-secondary">
            <span className="text-text-tertiary tabular">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-8 rounded-menu bg-muted px-4 py-3 text-body text-text-secondary">
        This step isn&apos;t open yet. Your account is saved, so you can come back and finish setup from here.
      </p>
    </PageContainer>
  )
}
