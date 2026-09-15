'use client'

import { MoreHorizontal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { removeFromOrgAction, setAdminAction, setUserSuspendedAction } from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { useLazyComponent } from '@/lib/client/lazy'
import { toast } from '@/lib/client/toast'
import { useAction } from '@/lib/client/use-action'
import type { Result } from '@/lib/shared/result'

type Person = { id: string; name: string; isAdmin: boolean; suspended: boolean; org: { kind: 'team' | 'sponsor'; label: string } | null }

const loadMenu = () => import('./person-actions-menu')

export type PersonMenuItem = { label: string; danger: boolean }

type Pending = { title: string; consequence: string; confirmLabel: string; pendingLabel: string; danger: boolean; run: () => Promise<Result<{ name: string }>>; done: (name: string) => string }

/** Row actions for a person in the admin directory. Every one confirms with its consequence. */
export function PersonActions({ person, isSelf }: { person: Person; isSelf: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<Pending | null>(null)
  const menu = useLazyComponent(loadMenu)
  const action = useAction(() => pending!.run(), {
    errorToast: false,
    onSuccess: (data) => {
      toast.success(pending!.done(data.name))
      setPending(null)
      router.refresh()
    },
  })

  const items: Array<Pending & { label: string; hidden?: boolean }> = [
    person.isAdmin
      ? {
          label: 'Remove admin access',
          hidden: isSelf,
          title: `Remove ${person.name}’s admin access?`,
          consequence: 'They can no longer open the admin console. Their team or company access is unchanged.',
          confirmLabel: 'Remove admin access',
          pendingLabel: 'Removing…',
          danger: true,
          run: () => setAdminAction({ userId: person.id, grant: false }),
          done: (n) => `${n} is no longer an admin.`,
        }
      : {
          label: 'Make admin',
          title: `Make ${person.name} an admin?`,
          consequence: 'They can review every pitch, approve companies, suspend accounts and see everyone’s email address.',
          confirmLabel: 'Make admin',
          pendingLabel: 'Granting…',
          danger: false,
          run: () => setAdminAction({ userId: person.id, grant: true }),
          done: (n) => `${n} is now an admin.`,
        },
    {
      label: person.org?.kind === 'sponsor' ? 'Remove from company' : 'Remove from team',
      hidden: !person.org,
      title: `Remove ${person.name} from ${person.org?.label ?? 'their org'}?`,
      consequence: 'They lose access to its pitches and profile right away, and can be invited back.',
      confirmLabel: 'Remove',
      pendingLabel: 'Removing…',
      danger: true,
      run: () => removeFromOrgAction({ userId: person.id }),
      done: (n) => `${n} was removed.`,
    },
    person.suspended
      ? {
          label: 'Unsuspend',
          hidden: isSelf,
          title: `Unsuspend ${person.name}?`,
          consequence: 'They can sign in and use FTC Pitfund again.',
          confirmLabel: 'Unsuspend',
          pendingLabel: 'Unsuspending…',
          danger: false,
          run: () => setUserSuspendedAction({ userId: person.id, suspended: false }),
          done: (n) => `${n} is active again.`,
        }
      : {
          label: 'Suspend',
          hidden: isSelf,
          title: `Suspend ${person.name}?`,
          consequence: 'They’re blocked from FTC Pitfund until you unsuspend them. Their team or company keeps working.',
          confirmLabel: 'Suspend',
          pendingLabel: 'Suspending…',
          danger: true,
          run: () => setUserSuspendedAction({ userId: person.id, suspended: true }),
          done: (n) => `${n} is suspended.`,
        },
  ]
  const visible = items.filter((i) => !i.hidden)
  if (visible.length === 0) return <span className="text-small text-text-tertiary">You</span>

  return (
    <>
      {menu.Component ? (
        <menu.Component name={person.name} items={visible} defaultOpen={menu.openOnMount} onSelect={(label) => setPending(visible.find((i) => i.label === label) ?? null)} />
      ) : (
        // The Radix menu loads on first hover, focus or click (plan §6).
        <IconButton
          size="sm"
          label={`Actions for ${person.name}`}
          icon={<MoreHorizontal aria-hidden="true" />}
          aria-haspopup="menu"
          aria-expanded={false}
          onPointerEnter={() => void menu.preload()}
          onFocus={() => void menu.preload()}
          onClick={menu.open}
        />
      )}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (action.pending) return
          if (!open) {
            action.reset()
            setPending(null)
          }
        }}
      >
        {pending ? (
          <DialogContent
            size="sm"
            title={pending.title}
            description={pending.consequence}
            dismissible={!action.pending}
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="secondary" disabled={action.pending}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button variant={pending.danger ? 'danger' : 'primary'} data-action-button="" loading={action.pending} loadingLabel={pending.pendingLabel} onClick={() => void action.run(undefined)}>
                  {pending.confirmLabel}
                </Button>
              </>
            }
          >
            {action.error ? (
              <p role="alert" className="text-body text-danger">
                {action.error.message}
              </p>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}
