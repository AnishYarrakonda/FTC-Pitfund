import type { Metadata } from 'next'

import { CompanyEditor } from '@/components/company/company-editor'
import { CompanyChecklist, CompanyStatusBanner } from '@/components/company/company-status'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { requireSponsorMember } from '@/lib/server/authz'
import { getCompanyProfile, listCompanyMembers } from '@/lib/server/data/company'
import { listOpenInvites } from '@/lib/server/data/invites'
import { guardPage } from '@/lib/server/page-guards'

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
        viewerId={viewer.id}
        profile={profile}
        members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))}
        invites={invites.map((i) => ({ id: i.id, email: i.email, expired: i.expired, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
      />
    </PageContainer>
  )
}
