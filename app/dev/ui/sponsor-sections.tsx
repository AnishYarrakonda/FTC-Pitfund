'use client'

import type { ReactNode } from 'react'

import { CompanyChecklist, CompanyStatusBanner } from '@/components/company/company-status'
import { QuestionsEditor } from '@/components/company/questions-editor'
import { InboxRow, type InboxRowData } from '@/components/inbox/inbox-row'
import { ConnectedPanel } from '@/components/pitch/connected-panel'
import { SponsorProfile } from '@/components/sponsors/sponsor-profile'
import { ClampedText } from '@/components/ui/clamped-text'
import { Facts, Meter } from '@/components/ui/facts'
import { EmptyState, KeyboardHint, StatusBadge } from '@/components/ui/feedback'
import { LinkTabs } from '@/components/ui/link-tabs'
import { DEFAULT_QUESTIONS, fillCompany } from '@/lib/shared/questions'

/*
 * /dev/ui specimens for the company side and admin console (prompt 3): inbox rows, the Connected
 * panel, company status and checklist, the questions editor, the company profile preview, URL tabs,
 * facts, meters and clamped text. Saving in the questions editor calls the real action, which refuses
 * without a company, so its error state is visible too.
 */

const LONG = 'Supercalifragilisticexpialidocious'.repeat(148).slice(0, 5000)
const NOW = new Date('2026-09-13T17:00:00Z')
const noop = () => {}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid min-w-0 scroll-mt-20 gap-5">
      <div className="grid gap-1">
        <h2 id={`${id}-title`} className="text-h3 font-semibold tracking-tight text-text">
          {title}
        </h2>
        <p className="text-body text-text-secondary">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Specimen({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'grid min-w-0 content-start gap-3 lg:col-span-2' : 'grid min-w-0 content-start gap-3'}>
      <p className="text-caption font-medium text-text-tertiary">{label}</p>
      <div className="min-w-0 rounded-dialog border border-border bg-surface p-5">{children}</div>
    </div>
  )
}

const row = (overrides: Partial<InboxRowData> & { status: InboxRowData['status'] }): InboxRowData => ({
  id: `row-${overrides.status}`,
  team: { number: 31579, name: 'Exodius', logoUrl: null, verified: true, location: 'Austin, Texas, USA', summary: 'Third-year Austin community team building a fast, reliable robot and free workshops for 600+ local students.' },
  ask: '$1,500',
  receivedAt: new Date(NOW.getTime() - 3 * 3600_000),
  respondedAt: overrides.status === 'sent' ? null : new Date(NOW.getTime() - 3600_000),
  ...overrides,
})

const profile = {
  id: 'preview',
  name: 'Ribosome Robotics',
  website: 'https://example.com/ribosome',
  logoUrl: null,
  city: 'Austin',
  state: 'TX',
  region: 'Texas and the Southwest',
  about: 'We sponsor teams that document their engineering process and bring robotics to students who would not otherwise see it.',
  supportTypes: ['funding', 'mentorship'] as Array<'funding' | 'mentorship'>,
  questions: DEFAULT_QUESTIONS.map((q) => ({ ...q, prompt: fillCompany(q.prompt, 'Ribosome Robotics') })),
  usesDefaultQuestions: true,
  verified: true,
}

export function SponsorSections() {
  return (
    <>
      <Section id="inbox" title="Company inbox" description="A pitch row in each state, a long one, and the inbox’s empty states.">
        <ul className="divide-y divide-border overflow-hidden rounded-dialog border border-border bg-surface" aria-label="Inbox rows">
          <li>
            <InboxRow pitch={row({ status: 'sent' })} href={null} now={NOW} />
          </li>
          <li>
            <InboxRow pitch={row({ status: 'matched', ask: 'Open to discuss' })} href={null} now={NOW} />
          </li>
          <li>
            <InboxRow pitch={row({ status: 'declined', ask: null, team: { ...row({ status: 'sent' }).team, verified: false, summary: null } })} href={null} now={NOW} />
          </li>
          <li>
            <InboxRow pitch={row({ status: 'sent', ask: '$999,999', team: { number: 999999, name: LONG.slice(0, 60), logoUrl: null, verified: true, location: LONG.slice(0, 120), summary: LONG.slice(0, 160) } })} href={null} now={NOW} />
          </li>
        </ul>
        <div className="grid gap-6 lg:grid-cols-2">
          <EmptyState title="You’ll see pitches here once approved" description="Each pitch answers your questions and includes the team’s deck." className="rounded-dialog border border-border bg-surface" />
          <EmptyState title="No pitches yet" description="Teams can now find Ribosome Robotics in the directory." className="rounded-dialog border border-border bg-surface" />
        </div>
      </Section>

      <Section id="connected" title="Connected panel" description="What each side sees once a company is interested: the other side’s name, title, email and phone.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ConnectedPanel title="You’re connected with Team 31579 · Exodius" description="We emailed you both. Reach out and take it from here." contactLabel="Coach" contact={{ name: 'Maya Chen', email: 'coach@pitfund.test', phone: '(512) 555-0142', teamUrl: 'https://pitfund.test/t/31579' }} />
          <ConnectedPanel title="Connected with Ribosome Robotics" description="Email delivery is delayed until tomorrow. Ribosome Robotics will still see it in FTC Pitfund." contact={{ name: LONG.slice(0, 120), email: 'sponsor@pitfund.test', phone: null, jobTitle: LONG, website: `https://example.com/${LONG.slice(0, 200)}` }} />
        </div>
      </Section>

      <Section id="company-status" title="Company status and checklist" description="Pending and rejected banners on /inbox and /company, and the setup checklist part-way done.">
        <div className="grid gap-4">
          <CompanyStatusBanner status="pending" name="Allele Components" note={null} />
          <CompanyStatusBanner status="rejected" name="QuickClone Promotions" note={LONG} />
          <CompanyChecklist linkItems={false} profile={{ logoUrl: 'x', about: 'We fund teams.', supportTypes: [], customQuestions: [], reviewedQuestions: false }} />
        </div>
      </Section>

      <Section id="questions-editor" title="Questions editor" description="The defaults with Customize, and a full list of ten (Add question is disabled with its reason). Reorder with the arrow buttons.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Specimen label="Default questions">
            <QuestionsEditor companyName="Ribosome Robotics" customQuestions={[]} reviewed={false} onPreviewChange={noop} />
          </Specimen>
          <Specimen label="Ten custom questions, long text">
            <QuestionsEditor
              companyName="BioBuzz Foundation"
              customQuestions={Array.from({ length: 10 }, (_, i) => ({ id: `g${i}`, prompt: i === 0 ? LONG.slice(0, 200) : `Question number ${i + 1}?`, help: i === 0 ? LONG.slice(0, 300) : undefined, required: i % 3 !== 2 }))}
              reviewed
              onPreviewChange={noop}
            />
          </Specimen>
        </div>
      </Section>

      <Section id="company-preview" title="What teams see" description="The company profile preview on /company and the admin company review, complete and with long text.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Specimen label="Complete">
            <SponsorProfile sponsor={profile} preview />
          </Specimen>
          <Specimen label="5,000-character strings">
            <SponsorProfile sponsor={{ ...profile, name: LONG.slice(0, 60), about: LONG, region: LONG.slice(0, 120), website: `https://example.com/${LONG.slice(0, 200)}`, usesDefaultQuestions: false, questions: [{ id: 'l', prompt: LONG.slice(0, 200), help: LONG.slice(0, 300), required: true }] }} preview />
          </Specimen>
        </div>
      </Section>

      <Section id="admin" title="Admin console" description="URL tabs with counts, facts, usage meters at each threshold, clamped text and keyboard hints.">
        <div className="grid gap-6 lg:grid-cols-2">
          <Specimen label="Tabs in the URL" wide>
            <LinkTabs
              label="Review queues (specimen)"
              active="pitches"
              tabs={[
                { key: 'pitches', label: 'Pitches', href: '#admin', count: 12 },
                { key: 'companies', label: 'Companies', href: '#admin', count: 2 },
                { key: 'teams', label: 'Teams', href: '#admin', count: 0 },
                { key: 'reports', label: 'Reports', href: '#admin', count: 1 },
              ]}
            />
          </Specimen>
          <Specimen label="Facts">
            <Facts
              rows={[
                { label: 'Verified', value: 'Yes' },
                { label: 'FIRST record', value: 'Found in FIRST records' },
                { label: 'Status', value: <StatusBadge label="Suspended" tone="danger" /> },
                { label: 'Long value', value: LONG.slice(0, 400) },
              ]}
            />
          </Specimen>
          <Specimen label="Meters: calm, warning, danger, empty">
            <div className="grid gap-5">
              <Meter label="Emails in the last 24 h" used={13} limit={100} display="13 / 100" warnAt={0.7} dangerAt={0.9} />
              <Meter label="Emails in the last 24 h" used={82} limit={100} display="82 / 100" warnAt={0.7} dangerAt={0.9} />
              <Meter label="Emails in the last 24 h" used={100} limit={100} display="100 / 100" warnAt={0.7} dangerAt={0.9} />
              <Meter label="File storage" used={0} limit={1024} display="0 B / 1 GB" />
            </div>
          </Specimen>
          <Specimen label="Clamped report details with Show more">
            <div className="grid gap-4">
              <ClampedText className="text-body text-text-secondary">{`The team sent the same generic pitch text to several companies. ${'It repeats. '.repeat(40)}`}</ClampedText>
              <ClampedText className="text-body text-text-secondary">{LONG}</ClampedText>
              <ClampedText className="text-body text-text-secondary">Short details never show the button.</ClampedText>
            </div>
          </Specimen>
          <Specimen label="Keyboard hints">
            <p className="flex flex-wrap items-center gap-2 text-small text-text-tertiary">
              <KeyboardHint keys={['A']} /> approve <KeyboardHint keys={['S']} /> send back <KeyboardHint keys={['R']} /> reject <KeyboardHint keys={['J']} /> next <KeyboardHint keys={['K']} /> previous
            </p>
          </Specimen>
        </div>
      </Section>
    </>
  )
}
