import { Mail } from 'lucide-react'
import type { ReactNode } from 'react'

import { PageContainer } from '@/components/ui/page'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

/* Whole-page states shared by layouts: suspended accounts and organizations. */

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
