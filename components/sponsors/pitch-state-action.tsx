'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { startPitchAction } from '@/app/actions/pitches'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { LinkPendingIndicator } from '@/components/ui/link-status'
import { PITCH_STATUS } from '@/lib/shared/labels'
import type { DirectoryState } from '@/lib/shared/pitch'

/** The team's status with a company: Start pitch, Continue draft, or where the pitch stands. */
export function PitchStateAction({ sponsorId, sponsorName, state, size = 'sm' }: { sponsorId: string; sponsorName: string; state: DirectoryState; size?: 'sm' | 'md' }) {
  const router = useRouter()
  if (state.kind === 'start') {
    return (
      <ActionButton
        size={size}
        variant={size === 'md' ? 'primary' : 'secondary'}
        action={() => startPitchAction({ sponsorId })}
        pendingLabel="Starting…"
        onSuccess={(data) => router.push(data.redirectTo)}
        aria-label={size === 'sm' ? `Start pitch to ${sponsorName}` : undefined}
      >
        Start pitch
      </ActionButton>
    )
  }
  if (state.status === 'draft' || state.status === 'changes_requested') {
    return (
      <Button asChild size={size} variant={size === 'md' ? 'primary' : 'secondary'}>
        <Link href={state.href} aria-label={size === 'sm' ? `${state.status === 'draft' ? 'Continue draft' : 'Edit and resubmit'} for ${sponsorName}` : undefined}>
          {state.status === 'draft' ? 'Continue draft' : 'Edit and resubmit'}
          <LinkPendingIndicator />
        </Link>
      </Button>
    )
  }
  const badge = PITCH_STATUS[state.status]
  return (
    <Link
      href={state.href}
      className="inline-flex h-8 items-center gap-2 rounded-control px-2 text-small font-medium text-text-secondary transition-colors duration-120 hover:bg-muted hover:text-text"
      aria-label={`${state.label}: view your pitch to ${sponsorName}`}
    >
      {/* Rejected and not-a-fit pitches read "Pitched this season": the slot is used, the details are on the pitch. */}
      <StatusBadge label={state.label === 'Pitched this season' ? state.label : badge.label} tone={state.label === 'Pitched this season' ? 'neutral' : badge.tone} />
      <ArrowRight aria-hidden="true" className="size-3.5" />
      <LinkPendingIndicator />
    </Link>
  )
}
