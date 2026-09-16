import { Check } from 'lucide-react'
import Link from 'next/link'

import { Banner } from '@/components/ui/feedback'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { cn } from '@/lib/shared/cn'
import { companyChecklist, companyStatusCopy } from '@/lib/shared/company'
import type { OrgStatus } from '@/lib/shared/types'

/* The company's review state (pending / rejected) and its setup checklist, on /inbox and /company. */

export function CompanyStatusBanner({ status, name, note, className }: { status: OrgStatus; name: string; note: string | null; className?: string }) {
  if (status === 'pending') {
    return (
      <Banner tone="info" title="Your company is under review" className={className}>
        {companyStatusCopy('pending', name)}
      </Banner>
    )
  }
  if (status === 'rejected') {
    return (
      <Banner tone="danger" title={`${name} wasn’t approved`} className={className}>
        <span className="grid gap-2">
          {note ? <span className="line-clamp-6 user-text-block">{note}</span> : null}
          <span>
            {companyStatusCopy('rejected', name)} If you think this is a mistake, email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent hover:text-accent-hover">
              {SUPPORT_EMAIL}
            </a>
            .
          </span>
        </span>
      </Banner>
    )
  }
  return null
}

export function CompanyChecklist({
  profile,
  className,
  linkItems = true,
}: {
  profile: { logoUrl: string | null; about: string | null; supportTypes: unknown[]; customQuestions: unknown[]; reviewedQuestions: boolean }
  className?: string
  linkItems?: boolean
}) {
  const checklist = companyChecklist({
    hasLogo: Boolean(profile.logoUrl),
    hasAbout: Boolean(profile.about?.trim()),
    supportTypeCount: profile.supportTypes.length,
    questionCount: profile.customQuestions.length,
    reviewedQuestions: profile.reviewedQuestions,
  })
  if (checklist.complete) return null
  return (
    <section aria-labelledby="checklist-heading" className={cn('grid gap-4 rounded-dialog border border-border bg-surface p-5 sm:p-6', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="checklist-heading" className="text-lead font-semibold tracking-tight text-text">
          Set up your company profile
        </h2>
        <p className="text-small text-text-tertiary tabular">
          {checklist.done} of {checklist.total} done
        </p>
      </div>
      <ul className="grid gap-2.5">
        {checklist.items.map((item) => (
          <li key={item.key} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn('grid size-5 shrink-0 place-items-center rounded-full border', item.done ? 'border-success bg-success text-white' : 'border-border-strong bg-surface')}
            >
              {item.done ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
            {item.done || !linkItems ? (
              <span className={cn('text-body', item.done ? 'text-text-tertiary line-through decoration-border-strong' : 'text-text')}>
                {item.label}
                <span className="sr-only">{item.done ? ' (done)' : ' (not done)'}</span>
              </span>
            ) : (
              <Link href={item.href} className="text-body font-medium text-accent hover:text-accent-hover">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
