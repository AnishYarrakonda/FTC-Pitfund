import type { Metadata } from 'next'
import Link from 'next/link'

import { PlaceholderPage } from '@/components/app/states'
import { Button } from '@/components/ui/button'
import { requireTeamMember } from '@/lib/server/authz'
import { guardPage } from '@/lib/server/page-guards'

export const metadata: Metadata = { title: 'Pitches' }

export default async function PitchesPage() {
  await guardPage(() => requireTeamMember())
  return (
    <PlaceholderPage
      title="Pitches"
      description="Every pitch your team starts, and where each one stands."
      emptyTitle="Your pitches will appear here"
      emptyDescription="Pick a company in the sponsor directory and answer its questions. A reviewer reads every pitch before the company sees it."
      action={
        <Button asChild>
          <Link href="/sponsors">Browse sponsors</Link>
        </Button>
      }
    />
  )
}
