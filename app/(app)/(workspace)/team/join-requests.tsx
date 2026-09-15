'use client'

import { UserRoundPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { decideJoin } from '@/app/actions/team'
import { ActionButton } from '@/components/ui/action-button'
import { TimeText } from '@/components/ui/time-text'

type Request = { id: string; name: string; email: string; createdAt: string }

/**
 * Join requests banner on /team (plan §3.2 "Join request"). Answered requests stay listed with
 * their outcome until the page is left, even after the refresh removes them from `requests`.
 */
export function JoinRequests({ requests }: { requests: Request[] }) {
  const router = useRouter()
  const [decided, setDecided] = useState<Record<string, string>>({})
  const [answered, setAnswered] = useState<Request[]>([])
  const shown = [...requests, ...answered.filter((a) => !requests.some((r) => r.id === a.id))]
  if (shown.length === 0) return null

  const settle = (request: Request, message: string) => {
    setAnswered((list) => [...list.filter((a) => a.id !== request.id), request])
    setDecided((d) => ({ ...d, [request.id]: message }))
    router.refresh()
  }

  return (
    <section id="requests" aria-label="Join requests" className="mb-10 scroll-mt-24 rounded-menu border border-info/20 bg-info-subtle">
      <ul className="divide-y divide-info/15">
        {shown.map((r) => {
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
              {decided[r.id] ? (
                <p role="status" className="shrink-0 pl-7 text-body text-text-secondary sm:pl-0">
                  {decided[r.id]}
                </p>
              ) : (
                <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    action={() => decideJoin({ requestId: r.id, decision: 'decline' })}
                    pendingLabel="Declining…"
                    onSuccess={() => settle(r, `Declined. We’ll let ${who} know.`)}
                  >
                    Decline
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    action={() => decideJoin({ requestId: r.id, decision: 'approve' })}
                    pendingLabel="Approving…"
                    onSuccess={() => settle(r, `${who} joined the team.`)}
                  >
                    Approve
                  </ActionButton>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
