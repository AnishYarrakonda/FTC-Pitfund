'use client'

import { useCallback, useState, type ReactNode } from 'react'

import { SponsorProfile } from '@/components/sponsors/sponsor-profile'
import { SponsorRow } from '@/components/sponsors/sponsor-summary'
import type { Question } from '@/lib/shared/questions'
import type { OrgStatus, SupportType } from '@/lib/shared/types'

import { CompanyProfileForm, draftWebsite, toCompanyDraft, type CompanyDraft, type CompanyProfileValues } from './company-profile-form'
import { QuestionsEditor } from './questions-editor'

export type CompanyEditorProfile = CompanyProfileValues & {
  id: string
  status: OrgStatus
  customQuestions: Question[]
  questions: Question[]
  usesDefaultQuestions: boolean
  reviewedQuestions: boolean
}

/**
 * /company: the profile and questions editors with a live "What teams see" preview, and members.
 * The preview renders the directory row and profile components coaches see (prompt 2).
 */
export function CompanyEditor({ profile, members }: { profile: CompanyEditorProfile; /** The members section, rendered on the server. */ members: ReactNode }) {
  const [draft, setDraft] = useState<{ values: CompanyDraft; logoUrl: string | null }>(() => ({ values: toCompanyDraft(profile), logoUrl: profile.logoUrl }))
  const [questions, setQuestions] = useState<{ list: Question[]; usesDefaults: boolean }>({ list: profile.questions, usesDefaults: profile.usesDefaultQuestions })

  const onDraftChange = useCallback((values: CompanyDraft, logoUrl: string | null) => setDraft({ values, logoUrl }), [])
  const onPreviewChange = useCallback((list: Question[], usesDefaults: boolean) => setQuestions({ list, usesDefaults }), [])

  const preview = {
    id: profile.id,
    name: draft.values.name.trim(),
    website: draftWebsite(draft.values),
    logoUrl: draft.logoUrl,
    city: draft.values.city.trim() || null,
    state: draft.values.state.trim() || null,
    region: draft.values.region.trim() || null,
    about: draft.values.about.trim() || null,
    supportTypes: draft.values.supportTypes as SupportType[],
    questions: questions.list,
    usesDefaultQuestions: questions.usesDefaults,
    verified: profile.status === 'approved',
  }

  const previewPanel = (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-1">
        <h2 className="text-lead font-semibold tracking-tight text-text">What teams see</h2>
        <p className="text-small text-text-tertiary">
          {profile.status === 'approved' ? 'Updates as you type. Save to publish your changes.' : 'Teams see this once your company is approved.'}
        </p>
      </div>
      <div className="grid gap-2">
        <p className="text-caption font-medium text-text-tertiary">In the directory</p>
        <div className="overflow-hidden rounded-dialog border border-border bg-surface">
          <SponsorRow sponsor={{ ...preview, name: preview.name || 'Your company' }} href={null} />
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-caption font-medium text-text-tertiary">Your company page</p>
        <div className="rounded-dialog border border-border bg-surface p-5">
          <SponsorProfile sponsor={preview} preview />
        </div>
      </div>
    </div>
  )

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-14">
      <div className="grid min-w-0 content-start">
        <CompanyProfileForm profile={profile} onDraftChange={onDraftChange} />
        <section aria-label="Preview" className="border-t border-border py-8 lg:hidden">
          {previewPanel}
        </section>
        <QuestionsEditor companyName={draft.values.name.trim() || profile.name} customQuestions={profile.customQuestions} reviewed={profile.reviewedQuestions} onPreviewChange={onPreviewChange} />
        {members}
      </div>
      <aside className="hidden min-w-0 lg:block" aria-label="What teams see">
        <div className="sticky top-24 max-h-[calc(100dvh-120px)] overflow-y-auto pb-4">{previewPanel}</div>
      </aside>
    </div>
  )
}
