import type { Metadata } from 'next'

import { inviteCompanyMember, leaveCompanyAction, removeCompanyMemberAction, resendCompanyInvite, revokeCompanyInvite } from '@/app/actions/company'
import { CompanyEditor } from '@/components/company/company-editor'
import { CompanyChecklist, CompanyStatusBanner } from '@/components/company/company-status'
import { MembersSection } from '@/components/members/members-section'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireSponsorMember } from '@/lib/server/authz'
import { getCompanyProfile, listCompanyMembers } from '@/lib/server/data/company'
import { listOpenInvites } from '@/lib/server/data/invites'
import { guardPage } from '@/lib/server/page-guards'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

export const metadata: Metadata = { title: 'Company' }

export default async function CompanyPage() {
  const viewer = await guardPage(() => requireSponsorMember())
  const [profile, members, invites] = await Promise.all([
    getCompanyProfile(viewer),
    listCompanyMembers(viewer),
    listOpenInvites({ kind: 'sponsor', id: viewer.sponsor.id }),
  ])

  return (
    <PageContainer>
      <PageHeader title={profile.name} description="Your company profile, the questions teams answer, and the people who share this account." />
      <div className="mb-10 grid gap-4 empty:hidden">
        <CompanyStatusBanner status={profile.status} name={profile.name} note={profile.statusNote} />
        {profile.status === 'pending' ? <CompanyChecklist profile={profile} /> : null}
      </div>
      <CompanyEditor
        profile={profile}
        members={
          <MembersSection
            viewerId={viewer.id}
            description={`Everyone here shares ${profile.name}’s account equally and gets the email when a pitch arrives.`}
            members={members}
            invites={invites.map((i) => ({ id: i.id, email: i.email, expired: i.expired, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
            actions={{ leave: leaveCompanyAction, remove: removeCompanyMemberAction, invite: inviteCompanyMember, resend: resendCompanyInvite, revoke: revokeCompanyInvite }}
            inviteDisabledReason={
              profile.status === 'approved' ? null : profile.status === 'pending' ? `You can invite coworkers once ${profile.name} is approved.` : `${profile.name} can’t invite coworkers right now.`
            }
            copy={{
              leaveLabel: 'Leave company',
              leaveTitle: `Leave ${profile.name}?`,
              leaveConsequence: 'You’ll lose access to its pitches and profile. A coworker can invite you back.',
              removeConsequence: 'They’ll lose access to the company’s pitches and profile right away. You can invite them again later.',
              removedFrom: profile.name,
              onlyMember: `You’re the only member. To leave, invite a coworker first, or email ${SUPPORT_EMAIL} to close the company.`,
              noInvites: 'No pending invites. Invite a coworker so pitches never wait on one person.',
              inviteTitle: 'Invite a coworker',
              inviteDescription: `They’ll get an email with a link to join ${profile.name}. It works once, for that address, for 14 days.`,
              inviteFieldLabel: 'Work email',
              invitePlaceholder: 'name@company.com',
            }}
          />
        }
      />
    </PageContainer>
  )
}
