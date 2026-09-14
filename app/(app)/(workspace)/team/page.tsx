import { ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireTeamMember } from '@/lib/server/authz'
import { listOpenInvites } from '@/lib/server/data/invites'
import { getTeamProfile, listPendingJoinRequests, listTeamMembers } from '@/lib/server/data/teams'
import { guardPage } from '@/lib/server/page-guards'
import { teamLabel } from '@/lib/shared/team'

import { DeckSection } from './deck-section'
import { JoinRequests } from './join-requests'
import { MembersSection } from './members-section'
import { ProfileForm } from './profile-form'
import { PublicPreview } from './public-preview'

export const metadata: Metadata = { title: 'Team' }

export default async function TeamPage() {
  const viewer = await guardPage(() => requireTeamMember())
  const [profile, members, invites, requests] = await Promise.all([
    getTeamProfile(viewer),
    listTeamMembers(viewer),
    listOpenInvites({ kind: 'team', id: viewer.team.id }),
    listPendingJoinRequests(viewer),
  ])

  return (
    <PageContainer>
      <PageHeader
        title={teamLabel(profile)}
        description="Your public profile, sponsorship deck and the coaches who share this account."
        actions={
          <Button asChild variant="secondary">
            <a href={`/t/${profile.number}`} target="_blank" rel="noreferrer">
              View public page
              <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
        }
      />

      <JoinRequests requests={requests.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
        <div className="grid min-w-0 content-start">
          <ProfileForm profile={profile} />
          <DeckSection deck={profile.deck} />
          <MembersSection
            viewerId={viewer.id}
            members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))}
            invites={invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
          />
        </div>
        <aside className="hidden min-w-0 lg:block" aria-label="Public page preview">
          <div className="sticky top-24">
            <PublicPreview profile={profile} />
          </div>
        </aside>
      </div>
    </PageContainer>
  )
}
