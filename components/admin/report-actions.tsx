'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { resolveReportAction } from '@/app/actions/admin'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'

/** Resolve a report, or resolve it and suspend the team (which hides the page and withdraws pitches in review). */
export function ReportActions({ reportId, teamNumber, teamSuspended }: { reportId: string; teamNumber: number; teamSuspended: boolean }) {
  const router = useRouter()
  return (
    <div className="flex flex-wrap gap-2">
      {teamSuspended ? null : (
        <ConfirmDialog
          trigger={
            <Button variant="secondary" size="sm" className="text-danger">
              Resolve &amp; suspend team
            </Button>
          }
          title={`Suspend Team ${teamNumber}?`}
          consequence="Its public page disappears, its coaches can’t pitch, and pitches waiting for review are withdrawn. You can unsuspend it later."
          confirmLabel="Resolve and suspend"
          pendingLabel="Suspending…"
          tone="danger"
          onConfirm={() => resolveReportAction({ reportId, suspendTeam: true })}
          onConfirmed={() => {
            toast.success(`Report resolved. Team ${teamNumber} is suspended.`)
            router.refresh()
          }}
        />
      )}
      <ActionButton
        size="sm"
        variant="secondary"
        action={() => resolveReportAction({ reportId, suspendTeam: false })}
        pendingLabel="Resolving…"
        onSuccess={() => {
          toast.success('Report resolved.')
          router.refresh()
        }}
      >
        Resolve
      </ActionButton>
    </div>
  )
}
