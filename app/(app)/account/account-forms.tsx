'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { startTransition, useEffect, useState } from 'react'

import { deleteMyAccount, saveProfile } from '@/app/actions/account'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner } from '@/components/ui/banner'
import { Field, FormSection } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAction } from '@/lib/client/use-action'

type Profile = { name: string; phone: string | null; jobTitle: string | null }

export function AccountForms({
  profile,
  email,
  context,
  deletionBlocked,
}: {
  profile: Profile
  email: string
  context: 'team' | 'sponsor' | null
  deletionBlocked: string | null
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<Profile>(profile)
  const [draft, setDraft] = useState({ name: profile.name, phone: profile.phone ?? '', jobTitle: profile.jobTitle ?? '' })
  const [justSaved, setJustSaved] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const dirty =
    draft.name !== saved.name || draft.phone !== (saved.phone ?? '') || (context === 'sponsor' && draft.jobTitle !== (saved.jobTitle ?? ''))

  const { run, pending, fieldErrors, error } = useAction(saveProfile, {
    errorToast: false,
    onSuccess: (row) => {
      if (!row) return
      setSaved(row)
      setDraft({ name: row.name, phone: row.phone ?? '', jobTitle: row.jobTitle ?? '' })
      setJustSaved(true)
      router.refresh()
    },
  })

  // Unsaved changes are protected (plan §3.1 #10).
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 3000)
    return () => clearTimeout(t)
  }, [justSaved])

  const phoneHint =
    context === 'sponsor'
      ? 'Optional. Shared only with teams you say you’re interested in.'
      : 'Optional. Shared only with a company that says it’s interested in your team’s pitch.'

  return (
    <div className="grid">
      <FormSection title="Profile" description="How you appear to your team or company, and to the people you connect with.">
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            void run({ name: draft.name, phone: draft.phone, jobTitle: draft.jobTitle })
          }}
        >
          <Field label="Name" required error={fieldErrors.name}>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="name" maxLength={120} />
          </Field>
          {context === 'sponsor' ? (
            <Field label="Job title" hint="Shared with teams along with your name when you connect." error={fieldErrors.jobTitle}>
              <Input value={draft.jobTitle} onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })} autoComplete="organization-title" maxLength={120} />
            </Field>
          ) : null}
          <Field label="Phone" hint={phoneHint} error={fieldErrors.phone}>
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} type="tel" autoComplete="tel" maxLength={40} />
          </Field>
          <Field label="Email" hint="You sign in with this address. It can’t be changed.">
            <Input value={email} readOnly />
          </Field>

          {error && !Object.keys(fieldErrors).length ? (
            <p role="alert" className="text-body text-danger">
              {error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <p className="mr-auto text-small text-text-tertiary" aria-live="polite">
              {dirty ? (
                'Unsaved changes'
              ) : justSaved ? (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <Check aria-hidden="true" className="size-4" /> Saved
                </span>
              ) : null}
            </p>
            {dirty ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setDraft({ name: saved.name, phone: saved.phone ?? '', jobTitle: saved.jobTitle ?? '' })}
              >
                Discard
              </Button>
            ) : null}
            <Button type="submit" data-action-button="" loading={pending} loadingLabel="Saving…" disabled={!dirty && !pending}>
              Save changes
            </Button>
          </div>
        </form>
      </FormSection>

      <FormSection title="Sign out" description="Sign out of FTC Pitfund on this device.">
        <div>
          <Button
            variant="secondary"
            data-action-button=""
            loading={signingOut}
            loadingLabel="Signing out…"
            onClick={() => {
              setSigningOut(true)
              startTransition(() => signOut())
            }}
          >
            Sign out
          </Button>
        </div>
      </FormSection>

      <FormSection title="Delete account" description="Remove your name, email and phone from FTC Pitfund and sign out everywhere.">
        {deletionBlocked ? (
          <Banner tone="warning" title="You can’t delete your account yet">
            {deletionBlocked}
          </Banner>
        ) : null}
        <div>
          <ConfirmDialog
            trigger={
              <Button variant="secondary" className="text-danger hover:text-danger" disabled={Boolean(deletionBlocked)}>
                Delete account
              </Button>
            }
            title="Delete your account?"
            consequence="Your details are removed and you’re signed out. Pitches and decisions you made stay with your team or company. This can’t be undone."
            confirmLabel="Delete account"
            pendingLabel="Deleting…"
            tone="danger"
            onConfirm={() => deleteMyAccount({ confirm: 'delete' })}
            onConfirmed={(data) => {
              window.location.assign(data.redirectTo)
            }}
          />
        </div>
      </FormSection>
    </div>
  )
}
