import type { Metadata } from 'next'
import Link from 'next/link'

import { PlaceholderPage } from '@/components/app/states'
import { Button } from '@/components/ui/button'
import { requireTeamMember } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'Sponsors' }

export default async function SponsorsPage() {
  await guardPage(() => requireTeamMember())
  return (
    <PlaceholderPage
      title="Sponsors"
      description="Companies on FTC Pitfund that want pitches from FTC teams."
      emptyTitle="The sponsor directory opens soon"
      emptyDescription="You'll search approved companies here, see what each one looks for, and start a pitch. Meanwhile, get your team profile ready."
      action={
        <Button asChild variant="secondary">
          <Link href="/team">Go to your team</Link>
        </Button>
      }
    />
  )
}
