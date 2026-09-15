'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

import { createCompanyUploadUrl, saveCompanyLogo, saveCompanyProfile } from '@/app/actions/company'
import { LogoUpload } from '@/components/uploads/logo-upload'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FormSection } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import { useUnsavedChanges } from '@/lib/client/use-unsaved-changes'
import { MAX_ABOUT_LENGTH, MAX_COMPANY_NAME_LENGTH, MAX_REGION_LENGTH } from '@/lib/shared/company'
import { SUPPORT_TYPE_LABEL } from '@/lib/shared/labels'
import { SUPPORT_TYPES, type SupportType } from '@/lib/shared/types'
import { displayWebsite, normalizeWebsite } from '@/lib/shared/url'

export type CompanyDraft = { name: string; website: string; city: string; state: string; region: string; about: string; supportTypes: SupportType[] }

export type CompanyProfileValues = {
  name: string
  website: string
  logoUrl: string | null
  city: string | null
  state: string | null
  region: string | null
  about: string | null
  supportTypes: SupportType[]
}

export const toCompanyDraft = (p: CompanyProfileValues): CompanyDraft => ({
  name: p.name,
  website: displayWebsite(p.website),
  city: p.city ?? '',
  state: p.state ?? '',
  region: p.region ?? '',
  about: p.about ?? '',
  supportTypes: p.supportTypes,
})

const SUPPORT_HINTS: Record<SupportType, string> = {
  funding: 'Money toward registration, parts or travel',
  equipment: 'Parts, tools, materials or machining time',
  software: 'Licenses, cloud credits or tools',
  mentorship: 'Time with your engineers or staff',
  other: 'Anything else, like venues or printing',
}

function sameDraft(a: CompanyDraft, b: CompanyDraft) {
  return (
    (['name', 'website', 'city', 'state', 'region', 'about'] as const).every((k) => a[k].trim() === b[k].trim()) &&
    [...a.supportTypes].sort().join() === [...b.supportTypes].sort().join()
  )
}

/** The company profile (prompt 3, scope B). Reports its draft upward so the preview updates live. */
export function CompanyProfileForm({ profile, onDraftChange }: { profile: CompanyProfileValues; onDraftChange: (draft: CompanyDraft, logoUrl: string | null) => void }) {
  const router = useRouter()
  const [saved, setSaved] = useState<CompanyDraft>(() => toCompanyDraft(profile))
  const [draft, setDraft] = useState<CompanyDraft>(() => toCompanyDraft(profile))
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl)
  const [justSaved, setJustSaved] = useState(false)
  const dirty = !sameDraft(draft, saved)

  const { run, pending, fieldErrors, error } = useAction(saveCompanyProfile, {
    errorToast: false,
    onSuccess: (row) => {
      const next = toCompanyDraft(row)
      setSaved(next)
      setDraft(next)
      setJustSaved(true)
      router.refresh()
    },
  })

  useUnsavedChanges(dirty)

  useEffect(() => {
    onDraftChange(draft, logoUrl)
  }, [draft, logoUrl, onDraftChange])

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 3000)
    return () => clearTimeout(t)
  }, [justSaved])

  const set = (key: Exclude<keyof CompanyDraft, 'supportTypes'>) => (e: { target: { value: string } }) => {
    setJustSaved(false)
    setDraft((d) => ({ ...d, [key]: e.target.value }))
  }

  const toggleType = (type: SupportType, on: boolean) => {
    setJustSaved(false)
    setDraft((d) => ({ ...d, supportTypes: on ? [...d.supportTypes, type] : d.supportTypes.filter((t) => t !== type) }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ ...draft, supportTypes: SUPPORT_TYPES.filter((t) => draft.supportTypes.includes(t)) })
  }

  return (
    <FormSection id="profile" title="Profile" description="What teams see in the directory and on your company page.">
      <LogoUpload
        name={draft.name || profile.name}
        currentUrl={profile.logoUrl}
        createUpload={(imageType) => createCompanyUploadUrl({ imageType })}
        finalize={(path) => saveCompanyLogo({ path })}
        onSaved={(url) => {
          setLogoUrl(url)
          router.refresh()
        }}
      />
      <form noValidate onSubmit={submit} className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company name" required error={fieldErrors.name}>
            <Input value={draft.name} onChange={set('name')} maxLength={MAX_COMPANY_NAME_LENGTH} autoComplete="organization" />
          </Field>
          <Field label="Website" required error={fieldErrors.website}>
            <Input value={draft.website} onChange={set('website')} type="url" inputMode="url" placeholder="example.com" autoComplete="url" maxLength={300} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" error={fieldErrors.city}>
            <Input value={draft.city} onChange={set('city')} maxLength={80} autoComplete="address-level2" />
          </Field>
          <Field label="State" error={fieldErrors.state}>
            <Input value={draft.state} onChange={set('state')} maxLength={80} autoComplete="address-level1" />
          </Field>
        </div>
        <Field label="Where we sponsor" hint="For example “Central Texas” or “Anywhere in the US”." error={fieldErrors.region}>
          <Input value={draft.region} onChange={set('region')} maxLength={MAX_REGION_LENGTH} />
        </Field>
        <Field label="What we look for" hint="The teams you want to hear from and what your support is for. Teams read this before they pitch." error={fieldErrors.about}>
          <Textarea value={draft.about} onChange={set('about')} maxLength={MAX_ABOUT_LENGTH} minRows={4} maxRows={12} placeholder="We sponsor teams that bring robotics to students who wouldn’t otherwise see it…" />
        </Field>
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-small font-medium text-text">Support we offer</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SUPPORT_TYPES.map((type) => (
              <Checkbox key={type} checked={draft.supportTypes.includes(type)} onCheckedChange={(on) => toggleType(type, on)} label={SUPPORT_TYPE_LABEL[type]} description={SUPPORT_HINTS[type]} />
            ))}
          </div>
          {fieldErrors.supportTypes ? (
            <p role="alert" className="text-small text-danger">
              {fieldErrors.supportTypes}
            </p>
          ) : null}
        </fieldset>

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
            <Button variant="ghost" disabled={pending} onClick={() => setDraft(saved)}>
              Discard
            </Button>
          ) : null}
          <Button type="submit" data-action-button="" loading={pending} loadingLabel="Saving…" disabled={!dirty && !pending}>
            Save profile
          </Button>
        </div>
      </form>
    </FormSection>
  )
}

/** The draft as the preview renders it (an unparseable website shows as typed). */
export function draftWebsite(draft: CompanyDraft) {
  return normalizeWebsite(draft.website) ?? ''
}
