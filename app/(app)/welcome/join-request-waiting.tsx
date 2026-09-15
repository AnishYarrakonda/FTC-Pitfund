'use client'

import { Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { cancelMyJoinRequest } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'

type Props = { request: { requestId: string; teamNumber: number; teamName: string } }

/** The waiting screen after "Request to join" (plan §3.2 "Coach first run"). */
export function JoinRequestWaiting({ request }: Props) {
  const router = useRouter()
  const team = `Team ${request.teamNumber} · ${request.teamName}`
  return (
    <section className="grid gap-8">
      <span className="grid size-10 place-items-center rounded-menu border border-border bg-surface text-text-tertiary">
        <Clock aria-hidden="true" className="size-5" />
      </span>
      <header className="grid gap-2">
        <h1 className="text-h1 font-semibold tracking-tighter text-text user-text">Request sent to {team}</h1>
        <p className="text-lead text-text-secondary">
          The team&apos;s coaches will see your request next time they open FTC Pitfund. We&apos;ll email you when one of them responds.
        </p>
      </header>
      <dl className="grid gap-x-6 gap-y-1 border-y border-border py-5 text-body sm:grid-cols-[160px_1fr] sm:gap-y-3">
        <dt className="text-text-tertiary">What happens next</dt>
        <dd className="mb-4 text-text sm:mb-0">Once a coach approves, you&apos;ll have full access to the team&apos;s pitches and profile.</dd>
        <dt className="text-text-tertiary">Wrong team?</dt>
        <dd className="text-text">Cancel this request, then look up your team number again.</dd>
      </dl>
      <div>
        <ConfirmDialog
          trigger={<Button variant="secondary">Cancel request</Button>}
          title="Cancel your request?"
          consequence={`${team}'s coaches won't see your request anymore. You can ask again later.`}
          confirmLabel="Cancel request"
          cancelLabel="Keep request"
          pendingLabel="Cancelling…"
          tone="danger"
          onConfirm={() => cancelMyJoinRequest({ requestId: request.requestId })}
          onConfirmed={() => router.refresh()}
        />
      </div>
    </section>
  )
}
