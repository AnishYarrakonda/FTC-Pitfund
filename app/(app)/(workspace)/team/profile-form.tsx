'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

import { createUploadUrl, saveLogo, saveTeamProfile } from '@/app/actions/team'
import { LogoUpload } from '@/components/uploads/logo-upload'
import { Button } from '@/components/ui/button'
import { Field, FormSection } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import { useUnsavedChanges } from '@/lib/client/use-unsaved-changes'
import type { TeamProfile } from '@/lib/server/data/teams'
import { MAX_SUMMARY_LENGTH, MAX_TEAM_NAME_LENGTH } from '@/lib/shared/team'
import { displayWebsite } from '@/lib/shared/url'

type Draft = { name: string; city: string; state: string; summary: string; website: string }

const toDraft = (p: Pick<TeamProfile, 'name' | 'city' | 'state' | 'summary' | 'website'>): Draft => ({
  name: p.name,
  city: p.city ?? '',
  state: p.state ?? '',
  summary: p.summary ?? '',
  website: p.website ? displayWebsite(p.website) : '',
})

/** Edit the team profile in place, with "Unsaved changes" and a leave warning. */
export function ProfileForm({ profile }: { profile: TeamProfile }) {
  const router = useRouter()
  const [saved, setSaved] = useState<Draft>(() => toDraft(profile))
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile))
  const [justSaved, setJustSaved] = useState(false)
  const dirty = (Object.keys(draft) as Array<keyof Draft>).some((k) => draft[k].trim() !== saved[k].trim())

  const { run, pending, fieldErrors, error } = useAction(saveTeamProfile, {
    errorToast: false,
    onSuccess: (row) => {
      const next = toDraft(row)
      setSaved(next)
      setDraft(next)
      setJustSaved(true)
      router.refresh()
    },
  })

  useUnsavedChanges(dirty)

  useEffect(() => {
    if (!justSaved) return
    const t = setTimeout(() => setJustSaved(false), 3000)
    return () => clearTimeout(t)
  }, [justSaved])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(draft)
  }

  const set = (key: keyof Draft) => (value: string) => {
    setJustSaved(false)
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <FormSection id="profile" title="Profile" description="What companies see on your public page and at the top of every pitch.">
      <LogoUpload
        name={draft.name || profile.name}
        currentUrl={profile.logoUrl}
        createUpload={(imageType) => createUploadUrl({ purpose: 'logo', imageType })}
        finalize={(path) => saveLogo({ path })}
        onSaved={() => router.refresh()}
      />
      <form noValidate onSubmit={submit} className="grid gap-5">
        <Field label="Team name" required error={fieldErrors.name}>
          <Input value={draft.name} onChange={(e) => set('name')(e.target.value)} maxLength={MAX_TEAM_NAME_LENGTH} autoComplete="organization" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" required error={fieldErrors.city}>
            <Input value={draft.city} onChange={(e) => set('city')(e.target.value)} maxLength={80} autoComplete="address-level2" />
          </Field>
          <Field label="State or region" required error={fieldErrors.state}>
            <Input value={draft.state} onChange={(e) => set('state')(e.target.value)} maxLength={80} autoComplete="address-level1" />
          </Field>
        </div>
        <Field
          label="One-line summary"
          hint="One sentence about your team. It appears on your public page and every pitch."
          error={fieldErrors.summary}
          aside={
            <span className={draft.summary.length >= MAX_SUMMARY_LENGTH ? 'text-warning tabular' : 'tabular'}>
              {draft.summary.length} / {MAX_SUMMARY_LENGTH}
            </span>
          }
        >
          <Textarea
            value={draft.summary}
            onChange={(e) => set('summary')(e.target.value.replace(/\n/g, ' '))}
            maxLength={MAX_SUMMARY_LENGTH}
            minRows={2}
            maxRows={5}
            counter="never"
            placeholder="Third-year community team building a reliable robot and free workshops for local students."
          />
        </Field>
        <Field label="Website" hint="Optional. Your team site or social page." error={fieldErrors.website}>
          <Input value={draft.website} onChange={(e) => set('website')(e.target.value)} type="url" inputMode="url" placeholder="exodiusftc.com" autoComplete="url" maxLength={300} />
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
