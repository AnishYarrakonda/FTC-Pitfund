'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { deleteDraftAction, withdrawPitchAction } from '@/app/actions/pitches'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { isWithdrawable } from '@/lib/shared/pitch'
import type { PitchStatus } from '@/lib/shared/types'

/** Primary actions by state (plan §2): continue, edit & resubmit, withdraw, delete draft. */
export function PitchActions({ pitchId, sponsorId, companyName, status }: { pitchId: string; sponsorId: string; companyName: string; status: PitchStatus }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className="grid shrink-0 justify-items-start gap-2 md:justify-items-end">
      <div className="flex flex-wrap gap-2">
        {isWithdrawable(status) ? (
          <ConfirmDialog
            trigger={<Button variant="secondary">Withdraw</Button>}
            title="Withdraw this pitch?"
            consequence={
              status === 'sent'
                ? `${companyName} will be told you withdrew it, and you can pitch them again this season.`
                : `It won’t be reviewed or sent to ${companyName}, and you can pitch them again this season.`
            }
            confirmLabel="Withdraw pitch"
            pendingLabel="Withdrawing…"
            tone="danger"
            onConfirm={() => withdrawPitchAction({ pitchId })}
            onConfirmed={(data) => {
              setMessage(
                data.companyNotified
                  ? data.emailDelayed
                    ? `Withdrawn. Email delivery is delayed until tomorrow; ${data.companyName} will still see it in FTC Pitfund.`
                    : `Withdrawn. We let ${data.companyName} know.`
                  : 'Withdrawn.',
              )
              router.refresh()
            }}
          />
        ) : null}
        {status === 'draft' ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="text-text-secondary">
                Delete draft
              </Button>
            }
            title="Delete this draft?"
            consequence={`Your answers to ${companyName} are deleted. You can start a new pitch to them later this season.`}
            confirmLabel="Delete draft"
            pendingLabel="Deleting…"
            tone="danger"
            onConfirm={() => deleteDraftAction({ pitchId })}
            onConfirmed={() => {
              router.push('/pitches')
              router.refresh()
            }}
          />
        ) : null}
        {status === 'draft' || status === 'changes_requested' ? (
          <Button asChild>
            <Link href={`/sponsors/${sponsorId}/pitch`}>{status === 'draft' ? 'Continue editing' : 'Edit and resubmit'}</Link>
          </Button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className="text-small text-text-secondary md:text-right">
          {message}
        </p>
      ) : null}
    </div>
  )
}
