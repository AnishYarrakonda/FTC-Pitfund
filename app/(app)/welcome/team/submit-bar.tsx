'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { submitTeam } from '@/app/actions/team'
import { ActionButton } from '@/components/ui/action-button'
import { toast } from '@/lib/client/toast'

/**
 * What's still missing, and the button that sends the team for review.
 *
 * The blockers are listed up front rather than appearing at the final click, so nobody fills the
 * whole page in and only then finds out they needed something else (the pitch composer does the
 * same thing for the same reason).
 */
export function SubmitBar({ blockers, resubmitting }: { blockers: string[]; resubmitting: boolean }) {
  const router = useRouter()
  const ready = blockers.length === 0

  return (
    <div className="grid gap-4 border-t border-border pt-8">
      {ready ? (
        <p className="flex items-start gap-2 text-body text-success">
          <Check aria-hidden="true" className="mt-[3px] size-4 shrink-0" />
          Everything we need is here.
        </p>
      ) : (
        <div className="grid gap-2">
          <p className="text-body font-medium text-text">Before you can send this in</p>
          <ul className="grid gap-1.5">
            {blockers.map((blocker) => (
              <li key={blocker} className="flex items-start gap-2 text-body text-text-secondary">
                <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-border-strong" />
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          action={() => submitTeam({ confirm: 'submit' })}
          disabled={!ready}
          pendingLabel="Sending…"
          onSuccess={(data) => {
            toast.success(resubmitting ? 'Sent in again. We’ll take another look.' : 'Sent. We’ll email you when we’ve checked your team.')
            router.push(data.redirectTo)
            router.refresh()
          }}
        >
          {resubmitting ? 'Send in again' : 'Send for review'}
        </ActionButton>
        <p className="text-small text-text-tertiary">A real person checks every team, usually within a day.</p>
      </div>
    </div>
  )
}
