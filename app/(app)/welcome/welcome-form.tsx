'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { completeWelcome } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Checkbox, RadioCards } from '@/components/ui/choice'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAction } from '@/lib/client/use-action'

type Role = 'team' | 'sponsor'

/** First run: who are you, plus terms and the 18+ confirmation (plan §3.2). */
export function WelcomeForm({ defaultName, email, defaultRole }: { defaultName: string; email: string; defaultRole?: Role }) {
  const router = useRouter()
  const [role, setRole] = useState<Role | ''>(defaultRole ?? '')
  const [name, setName] = useState(defaultName)
  const [adult, setAdult] = useState(false)
  const [terms, setTerms] = useState(false)
  const { run, pending, fieldErrors } = useAction(completeWelcome, {
    onSuccess: (data) => router.push(data.redirectTo),
  })

  return (
    <form
      noValidate
      className="grid gap-10"
      onSubmit={(e) => {
        e.preventDefault()
        void run({ role: role as Role, name, adult: adult as true, terms: terms as true })
      }}
    >
      <header className="grid gap-2">
        <p className="text-small font-medium text-accent">Signed in as {email}</p>
        <h1 className="text-h1 font-semibold tracking-tighter text-text">Welcome to FTC Pitfund</h1>
        <p className="text-lead text-text-secondary">A couple of details, then we&apos;ll set up your team or company.</p>
      </header>

      <div className="grid gap-8">
        <Field label="Your name" error={fieldErrors.name} hint="Shown to your team or company, and to the other side when you connect." required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} />
        </Field>

        <fieldset className="grid gap-3">
          <legend className="mb-3 text-small font-medium text-text">
            How will you use FTC Pitfund?<span className="text-text-tertiary"> *</span>
          </legend>
          <RadioCards<Role>
            label="How will you use FTC Pitfund?"
            value={role || undefined}
            onValueChange={setRole}
            options={[
              {
                value: 'team',
                label: 'I coach an FTC team',
                description: 'Set up your team, upload your sponsorship deck and pitch companies.',
              },
              {
                value: 'sponsor',
                label: 'I represent a company',
                description: 'Tell teams what you look for and review pitches that answer your questions.',
              },
            ]}
          />
          {fieldErrors.role ? (
            <p role="alert" className="text-small text-danger">
              {fieldErrors.role}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 border-t border-border pt-8">
          <Checkbox checked={adult} onCheckedChange={setAdult} label="I’m 18 or older" error={fieldErrors.adult} />
          <Checkbox
            checked={terms}
            onCheckedChange={setTerms}
            error={fieldErrors.terms}
            label={
              <>
                I accept the{' '}
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
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-text-tertiary">FTC Pitfund accounts are for adults. Students don&apos;t sign up.</p>
        <Button type="submit" size="lg" data-action-button="" loading={pending} loadingLabel="Continuing…">
          Continue
        </Button>
      </div>
    </form>
  )
}
