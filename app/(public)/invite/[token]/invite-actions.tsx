'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useState, type FormEvent } from 'react'

import { acceptInviteAction } from '@/app/actions/invites'
import { signOutForInvite } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useAction } from '@/lib/client/use-action'

export function AcceptInvite({ token, needsTerms }: { token: string; needsTerms: boolean }) {
  const router = useRouter()
  const [terms, setTerms] = useState(false)
  const { run, pending, error, fieldErrors } = useAction(acceptInviteAction, {
    errorToast: false,
    onSuccess: (data) => {
      router.push(data.redirectTo)
      router.refresh()
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ token, acceptsTerms: terms })
  }

  return (
    <form noValidate onSubmit={submit} className="mt-8 grid gap-6">
      {needsTerms ? (
        <Checkbox
          checked={terms}
          onCheckedChange={setTerms}
          disabled={pending}
          error={fieldErrors.terms}
          label={
            <>
              I’m 18 or older, and I accept the{' '}
              <Link href="/legal/terms" target="_blank" className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" target="_blank" className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
                Privacy Policy
              </Link>
            </>
          }
        />
      ) : null}
      {error && !fieldErrors.terms ? (
        <p role="alert" className="text-body text-danger">
          {error.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" size="lg" data-action-button="" loading={pending} loadingLabel="Joining…">
          Accept invite
        </Button>
      </div>
    </form>
  )
}

export function SignOutForInvite({ token }: { token: string }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="secondary"
      data-action-button=""
      loading={pending}
      loadingLabel="Signing out…"
      onClick={() => {
        setPending(true)
        startTransition(async () => window.location.assign((await signOutForInvite(token)).redirectTo))
      }}
    >
      Sign out
    </Button>
  )
}
