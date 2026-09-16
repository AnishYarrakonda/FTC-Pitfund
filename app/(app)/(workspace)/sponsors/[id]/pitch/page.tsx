import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { PageContainer } from '@/components/ui/page'
import { requireApprovedTeam } from '@/lib/server/authz'
import { getDirectorySponsor } from '@/lib/server/data/directory'
import { getComposerState } from '@/lib/server/data/pitches'
import { guardPage } from '@/lib/server/page-guards'
import { isEditable, mergeAnswers } from '@/lib/shared/pitch'

import { Composer } from './composer'

export const metadata: Metadata = { title: 'Pitch' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ComposerPage({ params }: PageProps<'/sponsors/[id]/pitch'>) {
  const [viewer, { id }] = await Promise.all([guardPage(() => requireApprovedTeam()), params])
  if (!UUID.test(id)) notFound()
  const [sponsor, state] = await Promise.all([getDirectorySponsor(id), getComposerState(viewer, id)])
  if (!sponsor) notFound()
  if (state.pitch && !isEditable(state.pitch.status)) redirect(`/pitches/${state.pitch.id}`)

  const merged = mergeAnswers(sponsor.questions, state.pitch?.answers ?? [])
  const pitch = state.pitch

  return (
    <PageContainer width="review">
      <Link href={`/sponsors/${sponsor.id}`} className="-ml-1 inline-flex items-center gap-1.5 rounded-control px-1 text-small font-medium text-text-secondary hover:text-text">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {sponsor.name}
      </Link>
      <Composer
        key={pitch?.id ?? 'new'}
        teamId={viewer.team.id}
        team={state.team}
        company={{ id: sponsor.id, name: sponsor.name, logoUrl: sponsor.logoUrl }}
        questions={sponsor.questions}
        initial={{
          pitchId: pitch?.id ?? null,
          status: pitch?.status === 'changes_requested' ? 'changes_requested' : 'draft',
          answers: Object.fromEntries(merged.answers.map((a) => [a.questionId, a.answer])),
          ask: {
            type: pitch?.askType ?? 'none',
            amountDollars: pitch?.askAmountCents ? Math.round(pitch.askAmountCents / 100) : null,
            note: pitch?.askNote ?? null,
          },
          savedAt: pitch?.updatedAt.toISOString() ?? null,
          reviewNote: pitch?.status === 'changes_requested' ? pitch.reviewNote : null,
          questionsChanged: merged.changed,
        }}
      />
    </PageContainer>
  )
}
