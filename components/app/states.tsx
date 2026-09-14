import { Mail } from 'lucide-react'
import type { ReactNode } from 'react'

import { PageContainer, PageHeader } from '@/components/ui/page'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

/* Whole-page states shared by layouts: suspended accounts/orgs and not-yet-built steps. */

export function SuspendedNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageContainer width="form">
      <div className="grid gap-6 py-10">
        <div className="grid gap-2">
          <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">{title}</h1>
          <div className="text-lead text-text-secondary">{children}</div>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="inline-flex w-fit items-center gap-2 rounded-control border border-border-strong bg-surface px-4 py-2 text-body font-medium text-text hover:bg-muted"
        >
          <Mail aria-hidden="true" className="size-4 text-text-tertiary" />
          Email {SUPPORT_EMAIL}
        </a>
      </div>
    </PageContainer>
  )
}

/**
 * A destination that exists in the navigation but whose feature ships in a later build step.
 * It says so plainly and offers the one useful next action; it never fakes content.
 */
export function PlaceholderPage({
  title,
  description,
  emptyTitle,
  emptyDescription,
  action,
  width = 'app',
}: {
  title: string
  description: string
  emptyTitle: string
  emptyDescription: ReactNode
  action?: ReactNode
  width?: 'app' | 'form' | 'review'
}) {
  return (
    <PageContainer width={width}>
      <PageHeader title={title} description={description} />
      <div className="rounded-dialog border border-border bg-surface">
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center sm:py-20">
          <h2 className="text-lead font-semibold tracking-tight text-text">{emptyTitle}</h2>
          <p className="mt-2 text-body text-text-secondary">{emptyDescription}</p>
          {action ? <div className="mt-6">{action}</div> : null}
        </div>
      </div>
    </PageContainer>
  )
}
