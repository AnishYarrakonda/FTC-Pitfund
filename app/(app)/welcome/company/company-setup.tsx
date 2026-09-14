'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { createCompanyAction } from '@/app/actions/company'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/choice'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAction } from '@/lib/client/use-action'
import { MAX_COMPANY_NAME_LENGTH, MAX_JOB_TITLE_LENGTH } from '@/lib/shared/company'

type Draft = { name: string; website: string; yourName: string; jobTitle: string; linkedin: string }

/** Company first run (prompt 3, scope A): the fields an admin needs to approve the company, nothing else. */
export function CompanySetup({ defaultName, defaultJobTitle }: { defaultName: string; defaultJobTitle: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>({ name: '', website: '', yourName: defaultName, jobTitle: defaultJobTitle, linkedin: '' })
  const [adult, setAdult] = useState(false)
  const [terms, setTerms] = useState(false)
  const { run, pending, fieldErrors, error } = useAction(createCompanyAction, {
    errorToast: false,
    onSuccess: (data) => {
      router.push(data.redirectTo)
      router.refresh()
    },
  })
  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ ...draft, adult: adult as true, terms: terms as true })
  }

  return (
    <form noValidate onSubmit={submit} className="mt-10 grid gap-10">
      <div className="grid gap-5">
        <Field label="Company name" required error={fieldErrors.name}>
          <Input value={draft.name} onChange={set('name')} maxLength={MAX_COMPANY_NAME_LENGTH} autoComplete="organization" autoFocus />
        </Field>
        <Field label="Company website" required error={fieldErrors.website} hint="An admin checks it before approving your company.">
          <Input value={draft.website} onChange={set('website')} type="url" inputMode="url" placeholder="example.com" autoComplete="url" maxLength={300} />
        </Field>
      </div>

      <div className="grid gap-5 border-t border-border pt-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Your name" required error={fieldErrors.yourName}>
            <Input value={draft.yourName} onChange={set('yourName')} autoComplete="name" maxLength={120} />
          </Field>
          <Field label="Your job title" required error={fieldErrors.jobTitle}>
            <Input value={draft.jobTitle} onChange={set('jobTitle')} autoComplete="organization-title" maxLength={MAX_JOB_TITLE_LENGTH} placeholder="Community Partnerships Lead" />
          </Field>
        </div>
        <Field
          label="Your LinkedIn profile"
          error={fieldErrors.linkedin}
          hint="Optional. It helps us confirm you work at the company, so approval is faster."
          aside="Optional"
        >
          <Input value={draft.linkedin} onChange={set('linkedin')} type="url" inputMode="url" placeholder="linkedin.com/in/your-name" maxLength={300} />
        </Field>
      </div>

      <div className="grid gap-4 border-t border-border pt-8">
        <Checkbox checked={adult} onCheckedChange={setAdult} label="I’m 18 or older and I represent this company" error={fieldErrors.adult} />
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

      <div className="grid gap-3">
        {error && !Object.keys(fieldErrors).length ? (
          <p role="alert" className="text-body text-danger">
            {error.message}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-text-tertiary">Teams can’t see your company until an admin approves it, usually within 1–2 days.</p>
          <Button type="submit" size="lg" data-action-button="" loading={pending} loadingLabel="Creating company…">
            Create company
          </Button>
        </div>
      </div>
    </form>
  )
}
