import { ArrowUpRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { switchPersona } from '@/app/actions/dev'
import { PublicHeader } from '@/components/app/public-chrome'
import { SubmitButton } from '@/components/ui/action-button'
import { Skeleton } from '@/components/ui/feedback'
import { Avatar } from '@/components/ui/identity'
import { PageContainer, PageHeader, Section } from '@/components/ui/page'
import { assertDevTools } from '@/lib/server/dev'
import { getViewer } from '@/lib/server/viewer'
import { PERSONAS, personaEmail } from '@/lib/shared/personas'

import { ResetData } from './reset-data'

export const metadata: Metadata = { title: 'Dev tools', robots: { index: false } }

const LINKS = [
  { href: 'http://127.0.0.1:54324', label: 'Mailpit', description: 'Every email the app sends locally' },
  { href: 'http://127.0.0.1:54323', label: 'Supabase Studio', description: 'Browse the local database' },
]

export default function DevPage() {
  assertDevTools()
  return (
    <div className="min-h-dvh bg-canvas">
      <PublicHeader
        action={
          <Link href="/dev/ui" className="text-body font-medium text-accent hover:text-accent-hover">
            Component gallery
          </Link>
        }
      />
      <PageContainer width="form">
        <PageHeader eyebrow="Local development only" title="Dev tools" description="Sign in as any seeded persona, reset data, and inspect local email." />
        <div className="grid gap-12">
          <Section title="Personas" description="One click signs in and lands on that persona's home.">
            <Suspense fallback={<Skeleton className="h-5 w-64" />}>
              <CurrentViewer />
            </Suspense>
            <ul className="divide-y divide-border rounded-menu border border-border bg-surface">
              {PERSONAS.map((persona) => (
                <li key={persona.key} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={persona.name} size="md" />
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate text-body font-medium text-text">{persona.name}</span>
                    <span className="truncate text-small text-text-tertiary">
                      {persona.description} · {personaEmail(persona.key)}
                    </span>
                  </div>
                  <form action={switchPersona}>
                    <input type="hidden" name="persona" value={persona.key} />
                    <SubmitButton variant="secondary" size="sm" pendingLabel="Signing in…" aria-label={`Sign in as ${persona.name}`}>
                      Sign in
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Data" description="Wipe and reseed the local database and storage.">
            <ResetData />
          </Section>

          <Section title="Local services">
            <ul className="divide-y divide-border rounded-menu border border-border bg-surface">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-canvas">
                    <span className="grid">
                      <span className="text-body font-medium text-text">{link.label}</span>
                      <span className="text-small text-text-tertiary">{link.description}</span>
                    </span>
                    <ArrowUpRight aria-hidden="true" className="size-4 text-text-tertiary" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </PageContainer>
    </div>
  )
}

async function CurrentViewer() {
  const viewer = await getViewer()
  return (
    <p className="text-body text-text-secondary">
      {viewer ? (
        <>
          Signed in as <span className="font-medium text-text">{viewer.email}</span>
        </>
      ) : (
        'Not signed in.'
      )}
    </p>
  )
}
