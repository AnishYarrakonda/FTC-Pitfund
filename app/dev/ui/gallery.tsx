'use client'

import { Bell, FileText, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from '@/lib/client/toast'

import { fakeFieldFailure, fakeSlowFailure, fakeSlowSuccess, fakeUnexpectedFailure } from '@/app/actions/dev'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Checkbox, RadioCards, SegmentedControl } from '@/components/ui/choice'
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger, Sheet, SheetContent, SheetTrigger } from '@/components/ui/dialog'
import {
  Banner,
  EmptyState,
  KeyboardHint,
  PageHeaderSkeleton,
  Skeleton,
  SkeletonList,
  SkeletonText,
  StatusBadge,
  Timeline,
} from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { FileDrop } from '@/components/ui/file-drop'
import { IconButton } from '@/components/ui/icon-button'
import { Avatar, OrgLogo, TeamMark } from '@/components/ui/identity'
import { Input, SearchInput } from '@/components/ui/input'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { PageContainer, PageHeader } from '@/components/ui/page'
import { PdfViewer } from '@/components/ui/pdf-viewer'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DataTable, Pagination } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import { EMAIL_STATUS, PITCH_STATUS, SPONSOR_STATUS } from '@/lib/shared/labels'
import { err, type Result } from '@/lib/shared/result'

import { CoachSections } from './coach-sections'
import { SponsorSections } from './sponsor-sections'

// A fixed clock so server and client render identical timestamps (no hydration mismatch).
const GALLERY_NOW = Date.parse('2026-09-13T17:00:00Z')
const LONG = 'Supercalifragilisticexpialidocious'.repeat(148).slice(0, 5000)
const LONG_SENTENCE = 'Our team builds robots after school and runs free workshops at the public library every month. '.repeat(12)

type Deck = { name: string; src: string; pages: number | null; thumb: string | null; logo: string | null } | null

const networkFailure = (): Promise<Result<never>> => Promise.reject(new TypeError('Failed to fetch'))

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['buttons', 'Buttons'],
  ['actions', 'Action buttons'],
  ['forms', 'Form controls'],
  ['files', 'File drop'],
  ['identity', 'Identity'],
  ['status', 'Status and feedback'],
  ['lists', 'Lists and tables'],
  ['overlays', 'Overlays'],
  ['menus', 'Menus'],
  ['loading', 'Loading'],
  ['pdf', 'PDF viewer'],
  ['pitch-view', 'Pitch view'],
  ['uploads', 'Uploads'],
  ['directory', 'Directory'],
  ['inbox', 'Inbox'],
  ['connected', 'Connected'],
  ['company-status', 'Company status'],
  ['questions-editor', 'Questions editor'],
  ['company-preview', 'What teams see'],
  ['admin', 'Admin console'],
  ['long', 'Long content'],
] as const

export function Gallery({ deck }: { deck: Deck }) {
  return (
    <PageContainer className="max-w-review">
      <PageHeader
        eyebrow="Local development only"
        title="Component gallery"
        description="Every component in every state, including 5,000-character unbroken strings. Click anything."
      />
      <nav aria-label="Gallery sections" className="-mt-2 mb-10 flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-6 text-small">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="font-medium text-text-secondary hover:text-text">
            {label}
          </a>
        ))}
      </nav>
      <div className="grid gap-16">
        <TokensSection />
        <ButtonsSection />
        <ActionsSection />
        <FormsSection />
        <FilesSection />
        <IdentitySection logo={deck?.logo ?? null} />
        <StatusSection />
        <ListsSection />
        <OverlaysSection />
        <MenusSection />
        <LoadingSection />
        <PdfSection deck={deck} />
        <CoachSections deck={deck} />
        <SponsorSections />
        <LongContentSection />
      </div>
    </PageContainer>
  )
}

function GallerySection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="grid min-w-0 scroll-mt-20 gap-5">
      <div className="grid gap-1">
        <h2 id={`${id}-title`} className="text-h3 font-semibold tracking-tight text-text">
          {title}
        </h2>
        {description ? <p className="text-body text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`grid min-w-0 content-start gap-3 rounded-menu border border-border bg-surface p-5 ${className ?? ''}`}>
      <p className="text-caption font-medium text-text-tertiary">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid gap-4 ${cols === 3 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}>{children}</div>
}

function TokensSection() {
  const colors = [
    ['canvas', 'bg-canvas'],
    ['surface', 'bg-surface'],
    ['muted', 'bg-muted'],
    ['border', 'bg-border'],
    ['border-strong', 'bg-border-strong'],
    ['text', 'bg-text'],
    ['text-secondary', 'bg-text-secondary'],
    ['text-tertiary', 'bg-text-tertiary'],
    ['accent', 'bg-accent'],
    ['accent-hover', 'bg-accent-hover'],
    ['accent-subtle', 'bg-accent-subtle'],
    ['success', 'bg-success'],
    ['warning', 'bg-warning'],
    ['danger', 'bg-danger'],
    ['info', 'bg-info'],
  ]
  const type = [
    ['display 44/52', 'text-display'],
    ['h1 30/38', 'text-h1'],
    ['h2 24/32', 'text-h2'],
    ['h3 20/28', 'text-h3'],
    ['lead 16/24', 'text-lead'],
    ['body 14/22', 'text-body'],
    ['small 13/20', 'text-small'],
    ['caption 12/16', 'text-caption'],
  ]
  return (
    <GallerySection id="tokens" title="Tokens" description="Plan §7. Light theme only; Inter; a 4 px spacing grid.">
      <Grid>
        <Specimen label="Color">
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {colors.map(([name, cls]) => (
              <li key={name} className="grid gap-1.5">
                <span className={`h-10 rounded-control border border-border ${cls}`} />
                <span className="text-caption text-text-secondary">{name}</span>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen label="Type scale">
          <ul className="grid gap-2">
            {type.map(([name, cls]) => (
              <li key={name} className="flex min-w-0 items-baseline justify-between gap-4">
                <span className={`${cls} min-w-0 truncate font-semibold tracking-tight text-text`}>Pitfund</span>
                <span className="shrink-0 text-caption text-text-tertiary">{name}</span>
              </li>
            ))}
          </ul>
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

function ButtonsSection() {
  const variants = ['primary', 'secondary', 'ghost', 'danger'] as const
  return (
    <GallerySection id="buttons" title="Buttons" description="Primary, secondary, ghost and danger at both sizes; disabled; loading.">
      <Grid>
        {variants.map((variant) => (
          <Specimen key={variant} label={variant}>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant={variant}>Save changes</Button>
              <Button variant={variant} size="sm">
                <Plus aria-hidden="true" />
                Invite
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
              <Button variant={variant} loading loadingLabel="Saving…">
                Save
              </Button>
            </div>
          </Specimen>
        ))}
        <Specimen label="Icon buttons (always labelled)">
          <div className="flex items-center gap-2">
            <IconButton label="Edit" icon={<Pencil aria-hidden="true" />} />
            <IconButton label="More actions" icon={<MoreHorizontal aria-hidden="true" />} variant="secondary" />
            <IconButton label="Delete" icon={<Trash2 aria-hidden="true" />} size="sm" />
            <IconButton label="Disabled" icon={<Bell aria-hidden="true" />} disabled />
          </div>
        </Specimen>
        <Specimen label="Link button and keyboard hints">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="link">View public page</Button>
            <span className="inline-flex items-center gap-2 text-small text-text-secondary">
              Approve <KeyboardHint keys={['A']} />
            </span>
            <span className="inline-flex items-center gap-2 text-small text-text-secondary">
              Next <KeyboardHint keys={['J']} /> Previous <KeyboardHint keys={['K']} />
            </span>
          </div>
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

function ActionsSection() {
  return (
    <GallerySection
      id="actions"
      title="Action buttons"
      description="Pending shows in the same frame as the click, sets aria-busy and ignores double clicks. Errors say what happened and what to do."
    >
      <Grid cols={3}>
        <Specimen label="Slow success, in-place confirmation">
          <ActionButton action={() => fakeSlowSuccess({})} pendingLabel="Sending…" successLabel="Sent">
            Approve & send
          </ActionButton>
        </Specimen>
        <Specimen label="Slow success, off-screen toast">
          <ActionButton variant="secondary" action={() => fakeSlowSuccess({})} pendingLabel="Resending…" successToast="Invite sent to jane@example.com">
            Resend invite
          </ActionButton>
        </Specimen>
        <Specimen label="Conflict (toast)">
          <ActionButton variant="secondary" action={() => fakeSlowFailure({})} pendingLabel="Rejecting…">
            Reject
          </ActionButton>
        </Specimen>
        <Specimen label="Unexpected error with reference">
          <ActionButton variant="danger" action={() => fakeUnexpectedFailure({})} pendingLabel="Deleting…">
            Delete
          </ActionButton>
        </Specimen>
        <Specimen label="Network failure with Retry">
          <ActionButton variant="secondary" action={networkFailure} pendingLabel="Saving…">
            Save draft
          </ActionButton>
        </Specimen>
        <Specimen label="Field error">
          <FieldErrorDemo />
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

function FieldErrorDemo() {
  const [name, setName] = useState('ab')
  const { run, pending, fieldErrors, data } = useAction(fakeFieldFailure, { successToast: (d) => `Saved “${d.name}”` })
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void run({ name })
      }}
    >
      <Field label="Team name" error={fieldErrors.name} hint="Try 3 or more characters.">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" data-action-button="" loading={pending} loadingLabel="Checking…">
          Save
        </Button>
        {data ? <span className="text-small text-success">Saved</span> : null}
      </div>
    </form>
  )
}

function FormsSection() {
  const [answer, setAnswer] = useState('Your support would cover our state championship registration.')
  const [segment, setSegment] = useState<'none' | 'amount' | 'in_kind' | 'open'>('amount')
  const [role, setRole] = useState<'team' | 'sponsor'>('team')
  const [checked, setChecked] = useState(true)
  const [query, setQuery] = useState('')
  return (
    <GallerySection id="forms" title="Form controls" description="Every control inside Field gets its label, hint, error and aria wiring.">
      <Grid>
        <Specimen label="Input states">
          <div className="grid gap-5">
            <Field label="Team name" hint="As it appears in FIRST records." required>
              <Input defaultValue="Exodius" />
            </Field>
            <Field label="Website" error="Enter a full address, like https://example.org">
              <Input defaultValue="exodius" />
            </Field>
            <Field label="Email" hint="You sign in with this address.">
              <Input defaultValue="maya@pitfund.test" readOnly />
            </Field>
            <Field label="Team number">
              <Input defaultValue="31579" disabled />
            </Field>
          </div>
        </Specimen>
        <Specimen label="Textarea (auto-grow, counter from 80%)">
          <div className="grid gap-5">
            <Field label="What would Brightline's support make possible?" required>
              <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={80} />
            </Field>
            <Field label="Always-on counter" hint="Up to 2,000 characters.">
              <Textarea defaultValue="" counter="always" maxLength={2000} minRows={2} />
            </Field>
          </div>
        </Specimen>
        <Specimen label="Select, search">
          <div className="grid gap-5">
            <Field label="Support type">
              <Select
                placeholder="Any support"
                options={[
                  { value: 'funding', label: 'Funding' },
                  { value: 'equipment', label: 'Equipment' },
                  { value: 'software', label: 'Software' },
                  { value: 'mentorship', label: 'Mentorship' },
                  { value: 'other', label: 'Other support', disabled: true },
                ]}
              />
            </Field>
            <Field label="Invalid select" error="Choose a support type">
              <Select options={[{ value: 'funding', label: 'Funding' }]} />
            </Field>
            <div className="grid gap-2">
              <SearchInput label="Search companies" placeholder="Search companies" onSearch={setQuery} />
              <p className="text-small text-text-tertiary" aria-live="polite">
                {query ? `Searching for “${query}”` : 'Type to search (debounced).'}
              </p>
            </div>
          </div>
        </Specimen>
        <Specimen label="Checkbox, radio cards, segmented control">
          <div className="grid gap-6">
            <div className="grid gap-3">
              <Checkbox checked={checked} onCheckedChange={setChecked} label="I have permission to share any photos of people in this document." />
              <Checkbox label="Required and unchecked" error="Confirm to continue" />
              <Checkbox label="Disabled" disabled defaultChecked description="You can't change this." />
            </div>
            <RadioCards<'team' | 'sponsor'>
              label="Role"
              value={role}
              onValueChange={setRole}
              options={[
                { value: 'team', label: 'I coach an FTC team', description: 'Pitch companies.' },
                { value: 'sponsor', label: 'I represent a company', description: 'Review pitches.' },
              ]}
            />
            <SegmentedControl
              label="Ask"
              value={segment}
              onValueChange={setSegment}
              options={[
                { value: 'none', label: 'No ask' },
                { value: 'amount', label: 'Amount' },
                { value: 'in_kind', label: 'In-kind' },
                { value: 'open', label: 'Open to discuss' },
              ]}
            />
          </div>
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

function FilesSection() {
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>({ loaded: 1.2e6, total: 4.3e6 })
  useEffect(() => {
    if (!progress) return
    const timer = setInterval(() => {
      setProgress((p) => (p ? { ...p, loaded: p.loaded >= p.total ? 0 : Math.min(p.total, p.loaded + 3e5) } : p))
    }, 400)
    return () => clearInterval(timer)
  }, [progress])
  return (
    <GallerySection id="files" title="File drop" description="Idle, uploading with byte progress and Cancel, a named stage, and an error with Retry.">
      <Grid>
        <Specimen label="Idle">
          <FileDrop title="Upload your sponsorship deck" description="PDF, up to 5 pages and 10 MB" accept="application/pdf" onFile={(f) => toast.info(`Picked ${f.name}`)} />
        </Specimen>
        <Specimen label="Uploading">
          <FileDrop
            title="Upload your sponsorship deck"
            description="PDF, up to 5 pages and 10 MB"
            accept="application/pdf"
            onFile={() => {}}
            progress={progress}
            onCancel={() => setProgress(null)}
          />
          {!progress ? (
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => setProgress({ loaded: 0, total: 4.3e6 })}>
              Restart upload
            </Button>
          ) : null}
        </Specimen>
        <Specimen label="Stage">
          <FileDrop title="Upload" description="PDF" accept="application/pdf" onFile={() => {}} stage="Checking your PDF…" />
        </Specimen>
        <Specimen label="Error">
          <FileDrop
            title="Upload your sponsorship deck"
            description="PDF, up to 5 pages and 10 MB"
            accept="application/pdf"
            onFile={() => {}}
            error="This PDF has 8 pages. The limit is 5."
            onRetry={() => toast.info('Retrying upload')}
          />
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

function IdentitySection({ logo }: { logo: string | null }) {
  return (
    <GallerySection id="identity" title="Identity" description="Avatars fall back to initials; logos to a neutral tile; names always wrap.">
      <Grid cols={3}>
        <Specimen label="Avatars">
          <div className="flex items-center gap-3">
            <Avatar name="Maya Chen" size="xs" />
            <Avatar name="Maya Chen" size="sm" />
            <Avatar name="Daniel Brooks" size="md" />
            <Avatar name="Priya" size="lg" />
          </div>
        </Specimen>
        <Specimen label="Org logos">
          <div className="flex items-center gap-3">
            <OrgLogo name="Exodius" src={logo} size="sm" />
            <OrgLogo name="Exodius" src={logo} size="md" />
            <OrgLogo name="Brightline Engineering" size="lg" />
            <OrgLogo name="Cedar Valley" size="xl" />
          </div>
        </Specimen>
        <Specimen label="Team marks">
          <div className="grid gap-4">
            <TeamMark name="Exodius" number={31579} logoSrc={logo} verified meta="Austin, TX" size="sm" />
            <TeamMark name="Voltage Vultures" number={24890} meta="Portland, OR" />
            <TeamMark name="Exodius" number={31579} logoSrc={logo} verified meta="Austin, TX" size="lg" />
          </div>
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

function StatusSection() {
  const now = GALLERY_NOW
  return (
    <GallerySection id="status" title="Status and feedback" description="Badges are dot + label, status only. Banners explain; empty states teach the next step.">
      <Grid>
        <Specimen label="Pitch statuses (coach labels)">
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {Object.values(PITCH_STATUS).map((s) => (
              <StatusBadge key={s.label} {...s} />
            ))}
          </div>
        </Specimen>
        <Specimen label="Company and email statuses">
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {Object.values(SPONSOR_STATUS).map((s) => (
              <StatusBadge key={s.label} {...s} />
            ))}
            {Object.values(EMAIL_STATUS).map((s) => (
              <StatusBadge key={`e-${s.label}`} {...s} />
            ))}
          </div>
        </Specimen>
        <Specimen label="Banners" className="md:col-span-2">
          <div className="grid gap-3">
            <Banner tone="info" title="A reviewer reads every pitch">
              Usually within a day. You can&apos;t edit a pitch while it&apos;s in review.
            </Banner>
            <Banner tone="warning" title="Email delivery is delayed until tomorrow" action={<Button size="sm" variant="secondary">View queue</Button>}>
              Brightline Engineering will still see it in FTC Pitfund.
            </Banner>
            <Banner tone="danger" title="Couldn't reach FTC Pitfund. Check your connection." action={<Button size="sm" variant="secondary">Retry</Button>} />
            <Banner tone="success" title="Deck updated · visible on your public page" />
          </div>
        </Specimen>
        <Specimen label="Empty state">
          <EmptyState
            icon={<FileText aria-hidden="true" />}
            title="No pitches yet"
            description="Pick a company in the sponsor directory and answer its questions."
            action={<Button>Browse sponsors</Button>}
          />
        </Specimen>
        <Specimen label="Timeline">
          <Timeline
            now={new Date(now)}
            events={[
              { id: '1', title: 'Draft started', at: new Date(now - 6 * 86400000), tone: 'neutral' },
              { id: '2', title: 'Submitted for review', description: 'By Maya Chen', at: new Date(now - 5 * 86400000), tone: 'info' },
              { id: '3', title: 'Sent back', description: 'Please say what the funding would pay for in the second answer.', at: new Date(now - 4 * 86400000), tone: 'warning' },
              { id: '4', title: 'Sent to Brightline Engineering', at: new Date(now - 3 * 3600000), tone: 'accent' },
              { id: '5', title: 'Matched', description: 'Daniel Brooks is interested.', at: new Date(now - 20 * 60000), tone: 'success' },
            ]}
          />
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

type Row = { id: string; team: string; number: number; company: string; status: keyof typeof PITCH_STATUS; updated: string }

function ListsSection() {
  const rows: Row[] = [
    { id: '1', team: 'Exodius', number: 31579, company: 'Brightline Engineering', status: 'matched', updated: '2 h ago' },
    { id: '2', team: 'Gear Grinders', number: 16072, company: 'Cedar Valley Credit Union', status: 'in_review', updated: 'yesterday' },
    { id: '3', team: LONG.slice(0, 60), number: 24890, company: LONG.slice(0, 300), status: 'changes_requested', updated: '3 days ago' },
  ]
  return (
    <GallerySection id="lists" title="Lists and tables" description="A table from 640 px, a stacked list below. Tabs carry counts.">
      <Tabs defaultValue="pitches">
        <TabsList>
          <TabsTrigger value="pitches" count={5}>
            Pitches
          </TabsTrigger>
          <TabsTrigger value="companies" count={2}>
            Companies
          </TabsTrigger>
          <TabsTrigger value="teams" count={0}>
            Teams
          </TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="pitches" className="pt-5">
          <DataTable<Row>
            caption="Pitches"
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { key: 'team', header: 'Team', className: 'w-[34%]', cell: (r) => <TeamMark name={r.team} number={r.number} size="sm" /> },
              { key: 'company', header: 'Company', cell: (r) => <span className="line-clamp-2 user-text">{r.company}</span> },
              { key: 'status', header: 'Status', className: 'w-36', cell: (r) => <StatusBadge {...PITCH_STATUS[r.status]} /> },
              { key: 'updated', header: 'Updated', className: 'w-28', align: 'right', cell: (r) => <span className="text-text-secondary">{r.updated}</span> },
            ]}
          />
          <Pagination summary="Showing 1–3 of 30" nextHref="/dev/ui?page=2#lists" />
        </TabsContent>
        <TabsContent value="companies" className="pt-5">
          <SkeletonList rows={2} />
        </TabsContent>
        <TabsContent value="teams" className="pt-5">
          <EmptyState title="You're all caught up" description="Every team on FTC Pitfund has been reviewed." />
        </TabsContent>
        <TabsContent value="reports" className="pt-5">
          <EmptyState title="No open reports" />
        </TabsContent>
      </Tabs>
    </GallerySection>
  )
}

function OverlaysSection() {
  const now = GALLERY_NOW
  const [confirmResult, setConfirmResult] = useState<string | null>(null)
  return (
    <GallerySection
      id="overlays"
      title="Overlays"
      description="Dialog sm 400 / md 560 / lg 720, Sheet 640 (full screen below 640 px). Header and footer stay put; only the body scrolls."
    >
      <Specimen label="Open each one">
        <div className="flex flex-wrap gap-3">
          {(['sm', 'md', 'lg'] as const).map((size) => (
            <Dialog key={size}>
              <DialogTrigger asChild>
                <Button variant="secondary" data-qa-overlay={`dialog-${size}`}>
                  Dialog {size}
                </Button>
              </DialogTrigger>
              <DialogContent
                size={size}
                title={size === 'sm' ? 'Send back with a note' : size === 'md' ? 'Invite a coach' : 'Why companies decline'}
                description={size === 'md' ? 'They must sign in with this email address. Invites expire in 14 days.' : undefined}
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button>{size === 'sm' ? 'Send back' : size === 'md' ? 'Send invite' : 'Done'}</Button>
                    </DialogClose>
                  </>
                }
              >
                {size === 'sm' ? (
                  <Field label="Note to the team" required>
                    <Textarea defaultValue="" maxLength={1000} placeholder="Say what to change." />
                  </Field>
                ) : size === 'md' ? (
                  <Field label="Email">
                    <Input type="email" placeholder="coach@example.org" />
                  </Field>
                ) : (
                  <div className="grid gap-3 text-body text-text-secondary">
                    {Array.from({ length: 14 }, (_, i) => (
                      <p key={i}>{LONG_SENTENCE}</p>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          ))}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" data-qa-overlay="dialog-long-word">
                Dialog with 5,000-char word
              </Button>
            </DialogTrigger>
            <DialogContent size="md" title={LONG.slice(0, 120)} description={LONG.slice(0, 400)} footer={<DialogClose asChild><Button>Close</Button></DialogClose>}>
              <p className="text-body text-text-secondary user-text-block">{LONG}</p>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" data-qa-overlay="sheet">
                <Users aria-hidden="true" />
                Sheet
              </Button>
            </SheetTrigger>
            <SheetContent
              title="Team 31579 · Exodius"
              description="Verified · 2 members · created Aug 12"
              footer={
                <>
                  <Button variant="secondary">Suspend team</Button>
                  <Button>Verify team</Button>
                </>
              }
            >
              <div className="grid gap-6">
                <TeamMark name="Exodius" number={31579} verified meta="Austin, TX" size="lg" />
                <Timeline
                  now={new Date(now)}
                  events={Array.from({ length: 12 }, (_, i) => ({
                    id: String(i),
                    title: i % 2 ? 'Pitch sent to Brightline Engineering' : 'Member joined',
                    description: LONG_SENTENCE.slice(0, 120),
                    at: new Date(now - i * 86400000),
                  }))}
                />
              </div>
            </SheetContent>
          </Sheet>
          <ConfirmDialog
            trigger={
              <Button variant="secondary" data-qa-overlay="confirm-success">
                Confirm (succeeds)
              </Button>
            }
            title="Send this pitch to Brightline Engineering for review?"
            consequence="A Pitfund reviewer reads every pitch before it reaches Brightline Engineering, usually within a day. You can't edit it while it's in review."
            confirmLabel="Submit pitch"
            pendingLabel="Submitting…"
            onConfirm={() => fakeSlowSuccess({})}
            onConfirmed={() => setConfirmResult('Submitted. Status: In review.')}
          />
          <ConfirmDialog
            trigger={
              <Button variant="secondary" data-qa-overlay="confirm-failure">
                Confirm (fails)
              </Button>
            }
            title="Remove Leah Okafor from the team?"
            consequence="They lose access to your team's pitches and profile right away."
            confirmLabel="Remove member"
            pendingLabel="Removing…"
            tone="danger"
            onConfirm={() => fakeSlowFailure({})}
          />
          <ConfirmDialog
            trigger={
              <Button variant="secondary" data-qa-overlay="confirm-network">
                Confirm (offline)
              </Button>
            }
            title="Withdraw this pitch?"
            consequence="Cedar Valley Credit Union won't see it anymore, and you can pitch them again this season."
            confirmLabel="Withdraw"
            pendingLabel="Withdrawing…"
            tone="danger"
            onConfirm={() => Promise.resolve(err('UNAVAILABLE', "Couldn't reach FTC Pitfund. Check your connection."))}
          />
        </div>
        {confirmResult ? (
          <p className="mt-4 text-small text-success" role="status">
            {confirmResult}
          </p>
        ) : null}
      </Specimen>
    </GallerySection>
  )
}

function MenusSection() {
  return (
    <GallerySection id="menus" title="Menus, popovers, tooltips, toasts">
      <Specimen label="Open each one">
        <div className="flex flex-wrap items-center gap-3">
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary">Menu</Button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuLabel>Leah Okafor</MenuLabel>
              <MenuItem icon={<Pencil aria-hidden="true" />}>Edit</MenuItem>
              <MenuItem icon={<Users aria-hidden="true" />}>Resend invite</MenuItem>
              <MenuSeparator />
              <MenuItem tone="danger" icon={<Trash2 aria-hidden="true" />}>
                Remove from team
              </MenuItem>
            </MenuContent>
          </Menu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" data-qa-overlay="popover">
                Popover
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="grid gap-2 p-4">
              <p className="text-body font-medium text-text">Verified teams</p>
              <p className="text-small text-text-secondary">An FTC Pitfund admin checked this team against FIRST records.</p>
            </PopoverContent>
          </Popover>
          <Tooltip content="Verified by FTC Pitfund">
            <Button variant="ghost">Hover or focus for a tooltip</Button>
          </Tooltip>
          <Button variant="secondary" onClick={() => toast.success('Sent to Brightline Engineering · 2 people notified')}>
            Success toast
          </Button>
          <Button variant="secondary" onClick={() => toast.error('Something went wrong on our side. Reference 3f9a2c1b7e04.')}>
            Error toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.error("Couldn't reach FTC Pitfund. Check your connection.", { action: { label: 'Retry', onClick: () => toast.success('Reconnected') } })}
          >
            Toast with action
          </Button>
        </div>
      </Specimen>
    </GallerySection>
  )
}

function LoadingSection() {
  return (
    <GallerySection id="loading" title="Loading" description="Skeletons mirror the final layout. Waits over a second say what is happening.">
      <Grid>
        <Specimen label="Page header + list skeleton">
          <PageHeaderSkeleton />
          <SkeletonList rows={3} />
        </Specimen>
        <Specimen label="Text skeleton and labelled waits">
          <div className="grid gap-6">
            <SkeletonText lines={4} />
            <div className="flex items-center gap-2 text-body text-text-secondary">
              <Spinner className="text-accent" /> Checking FIRST records…
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-menu" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-3.5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
        </Specimen>
      </Grid>
    </GallerySection>
  )
}

function PdfSection({ deck }: { deck: Deck }) {
  return (
    <GallerySection id="pdf" title="PDF viewer" description="pdf.js loads only when the viewer scrolls into view.">
      <div className="max-w-reading">
        {deck ? (
          <PdfViewer src={deck.src} title={`${deck.name} sponsorship deck`} pages={deck.pages} thumbnailSrc={deck.thumb} />
        ) : (
          <EmptyState title="No seeded deck" description="Run `npm run seed` to see the viewer with a real PDF." />
        )}
      </div>
    </GallerySection>
  )
}

function LongContentSection() {
  const now = GALLERY_NOW
  return (
    <GallerySection id="long" title="Long content" description="5,000-character unbroken strings must wrap inside every container. Nothing scrolls sideways.">
      <Grid>
        <Specimen label="Text block">
          <p className="text-body text-text-secondary user-text-block" data-qa-long="">
            {LONG}
          </p>
        </Specimen>
        <Specimen label="Team mark, banner, badge row">
          <div className="grid gap-4">
            <TeamMark name={LONG.slice(0, 400)} number={31579} verified meta={LONG.slice(0, 200)} />
            <Banner tone="warning" title={LONG.slice(0, 300)} action={<Button size="sm" variant="secondary">Retry</Button>}>
              {LONG.slice(0, 900)}
            </Banner>
          </div>
        </Specimen>
        <Specimen label="Field with long value and error">
          <div className="grid gap-4">
            <Field label={LONG.slice(0, 200)} error={LONG.slice(0, 500)} hint={LONG.slice(0, 300)}>
              <Input defaultValue={LONG} />
            </Field>
            <Field label="Answer">
              <Textarea defaultValue={LONG} maxLength={5000} maxRows={6} />
            </Field>
          </div>
        </Specimen>
        <Specimen label="Timeline and empty state">
          <Timeline now={new Date(now)} events={[{ id: 'l', title: LONG.slice(0, 300), description: LONG.slice(0, 2000), at: new Date(now), tone: 'warning' }]} />
          <EmptyState title={LONG.slice(0, 200)} description={LONG.slice(0, 600)} action={<Button>Do the thing</Button>} />
        </Specimen>
      </Grid>
    </GallerySection>
  )
}
