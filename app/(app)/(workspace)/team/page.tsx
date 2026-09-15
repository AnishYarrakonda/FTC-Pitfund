import { ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'

import { inviteTeamMember, resendTeamInvite, revokeTeamInvite } from '@/app/actions/invites'
import { leaveMyTeam, removeMember } from '@/app/actions/team'
import { MembersSection } from '@/components/members/members-section'
import { Button } from '@/components/ui/button'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireTeamMember } from '@/lib/server/authz'
import { listOpenInvites } from '@/lib/server/data/invites'
import { getTeamProfile, listPendingJoinRequests, listTeamMembers } from '@/lib/server/data/teams'
import { guardPage } from '@/lib/server/page-guards'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { teamLabel } from '@/lib/shared/team'

import { DeckSection } from './deck-section'
import { JoinRequests } from './join-requests'
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
            description="Everyone here shares the team account equally: the profile, the deck and every pitch."
            members={members}
            invites={invites.map((i) => ({ id: i.id, email: i.email, expired: i.expired, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
            actions={{ leave: leaveMyTeam, remove: removeMember, invite: inviteTeamMember, resend: resendTeamInvite, revoke: revokeTeamInvite }}
            copy={{
              leaveLabel: 'Leave team',
              leaveTitle: 'Leave this team?',
              leaveConsequence: 'You’ll lose access to the team’s profile and pitches. A coach on the team can invite you back.',
              removeConsequence: 'They’ll lose access to the team’s profile and pitches right away. You can invite them again later.',
              removedFrom: 'the team',
              onlyMember: `You’re the only member. To leave, invite another coach first, or email ${SUPPORT_EMAIL} to delete the team.`,
              noInvites: 'No pending invites. Invite a co-coach so the team isn’t locked to one person.',
              inviteTitle: 'Invite a coach',
              inviteDescription: 'They’ll get an email with a link. It works once, for that address, for 14 days.',
              inviteFieldLabel: 'Email address',
              invitePlaceholder: 'coach@example.com',
              inviteFootnote: 'Invite adult coaches and mentors only. Students don’t get accounts.',
            }}
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
