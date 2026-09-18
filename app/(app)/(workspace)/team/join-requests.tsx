'use client'

import { UserRoundPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { decideJoin } from '@/app/actions/team'
import { ActionButton } from '@/components/ui/action-button'
import { TimeText } from '@/components/ui/time-text'
import { toast } from '@/lib/client/toast'

type Request = { id: string; name: string; email: string; createdAt: string }

/**
 * Join requests on /team (plan §3.2 "Join request"). Only the owner sees this, because only the
 * owner decides who is on the team.
 *
 * The outcome is a toast, not a line that stays in the row: the row itself disappears on the
 * refresh, which is the real answer to "did that work". An earlier version kept answered requests
 * listed with their outcome until you navigated away, which read as a notification that would not
 * go away.
 */
export function JoinRequests({ requests }: { requests: Request[] }) {
  const router = useRouter()
  if (requests.length === 0) return null

  const settle = (message: string) => {
    toast.success(message)
    router.refresh()
  }

  return (
    <section id="requests" aria-label="Join requests" className="mb-10 scroll-mt-24 rounded-menu border border-info/20 bg-info-subtle">
      <ul className="divide-y divide-info/15">
        {requests.map((r) => {
          const who = r.name.trim() || r.email
          return (
            <li key={r.id} className="flex min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <UserRoundPlus aria-hidden="true" className="mt-[3px] size-4 shrink-0 text-info" />
                <div className="grid min-w-0">
                  <p className="min-w-0 text-body font-medium text-text user-text">
                    {who} ({r.email}) wants to join
                  </p>
                  <p className="text-small text-text-secondary">
                    Asked <TimeText date={r.createdAt} />. Approve only people you know coach or mentor this team.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  action={() => decideJoin({ requestId: r.id, decision: 'decline' })}
                  pendingLabel="Declining…"
                  onSuccess={() => settle(`Declined. We’ll let ${who} know.`)}
                >
                  Decline
                </ActionButton>
                <ActionButton
                  size="sm"
                  action={() => decideJoin({ requestId: r.id, decision: 'approve' })}
                  pendingLabel="Approving…"
                  onSuccess={() => settle(`${who} joined the team.`)}
                >
                  Approve
                </ActionButton>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
