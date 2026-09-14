'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { dismissEmailAction, retryEmailAction, sendEmailNowAction } from '@/app/actions/admin'
import { ActionButton } from '@/components/ui/action-button'

/** Retry / Dismiss a failed or bounced email; Send now for a queued one when the quota has room. */
export function EmailActions({ id, kind }: { id: string; kind: 'problem' | 'queued' }) {
  const router = useRouter()
  if (kind === 'queued') {
    return (
      <ActionButton
        size="sm"
        variant="secondary"
        action={() => sendEmailNowAction({ id })}
        pendingLabel="Sending…"
        onSuccess={(d) => {
          if (d.outcome === 'sent') toast.success(`Sent to ${d.to}.`)
          else if (d.outcome === 'deferred') toast.warning('The daily email limit is reached. It stays queued until the limit resets.')
          else toast.warning(`Resend didn’t accept it yet. It will retry automatically.`)
          router.refresh()
        }}
      >
        Send now
      </ActionButton>
    )
  }
  return (
    <div className="flex gap-1">
      <ActionButton
        size="sm"
        variant="secondary"
        action={() => retryEmailAction({ id })}
        pendingLabel="Retrying…"
        onSuccess={(d) => {
          toast.success(`Queued again for ${d.to}.`)
          router.refresh()
        }}
      >
        Retry
      </ActionButton>
      <ActionButton
        size="sm"
        variant="ghost"
        action={() => dismissEmailAction({ id })}
        pendingLabel="Dismissing…"
        onSuccess={() => router.refresh()}
      >
        Dismiss
      </ActionButton>
    </div>
  )
}
