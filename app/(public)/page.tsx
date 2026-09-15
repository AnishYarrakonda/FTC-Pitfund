import type { Metadata } from 'next'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { LandingSessionActions } from '@/components/app/landing-session-actions'
import { Wordmark } from '@/components/app/wordmark'
import { buttonVariants } from '@/components/ui/button'
import { FIRST_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/shared/brand'
import { cn } from '@/lib/shared/cn'
import composerShot from '@/public/marketing/composer.webp'
import inboxShot from '@/public/marketing/inbox-pitch.webp'
import teamPageShot from '@/public/marketing/team-page.webp'

/*
 * Landing page (plan §1 "The pitch"). Fully static: no cookies, no database. The screenshots are
 * real product captures made by `npm run screenshots:marketing`. Whether someone is signed in is
 * decided in the browser by <LandingSessionActions>.
 */

export const metadata: Metadata = {
  title: { absolute: 'FTC Pitfund · Sponsorship pitches companies actually read' },
  description:
    'FIRST® Tech Challenge teams pitch companies that already sponsor robotics. Answer each company’s own questions, and a real person checks every pitch before it lands.',
  alternates: { canonical: '/' },
}

const teamSteps = [
  { title: 'Set up your team once', body: 'Look up your team number, upload your sponsorship deck (one PDF, up to five pages) and write a one-line summary.' },
  { title: 'Answer each company’s questions', body: 'Every company on FTC Pitfund sponsors teams and says exactly what it wants to know. You answer that, not a generic form.' },
  { title: 'A person reviews it, then it lands', body: 'A reviewer reads every pitch before the company sees it and sends it back with a note if something needs work.' },
]

const companySteps = [
  { title: 'Create your company profile', body: 'Describe what you sponsor and write up to ten questions. We check every company before teams can see it.' },
  { title: 'Receive screened pitches', body: 'Each pitch answers your questions, includes the team’s deck and has already been read by a reviewer.' },
  { title: 'Say Interested or Not a fit', body: 'One click either way. Interested shares contact details with that team so you can take it from there.' },
]

const companyBenefits = [
  { title: 'Your questions, answered', body: 'Ask about budget, outreach, location, anything. Teams answer your questions in every pitch.' },
  { title: 'Nothing unscreened', body: 'A reviewer approves every pitch before it reaches you, so your inbox holds real teams with finished pitches.' },
  { title: 'One inbox for every team', body: 'Decks, answers and each team’s public page in one place, instead of scattered emails and forms.' },
  { title: 'Contacts only when you want them', body: 'Your contact details go to a team only after you say Interested. Saying Not a fit closes the pitch politely.' },
]

const faqs = [
  {
    q: 'Is it free?',
    a: 'Yes, for teams and companies. FTC Pitfund never handles money: when a company is interested, you arrange the sponsorship directly with each other.',
  },
  {
    q: 'Who reviews pitches?',
    a: 'The FTC Pitfund reviewers, run by FTC Team 31579 Exodius. They read every pitch before a company sees it and either send it on or return it with a note saying what to fix. They also approve each company before teams can pitch it.',
  },
  {
    q: 'What gets shared and when?',
    a: 'Your team page (name, number, logo, summary and deck) is public. A pitch’s answers go only to the company you pitched, after review. Names, emails and phone numbers are shared only when a company says Interested, and only between that team and that company.',
  },
  {
    q: 'Can students use it?',
    a: 'No. Accounts are for adults: coaches, mentors and parents who handle sponsorship. Students don’t need an account to be represented; the team page and deck speak for the team.',
  },
  {
    q: 'What about photos of students?',
    a: 'Whoever uploads a deck confirms they have permission to share any photos of people in it. Anyone can report a team page, and a reviewer takes down anything that shouldn’t be there.',
  },
  {
    q: 'Is this run by FIRST?',
    a: 'No. FTC Pitfund is an independent project built by FTC Team 31579 Exodius. It is not affiliated with or endorsed by FIRST®.',
  },
]

/** Screenshots beside text take 7/12 of the 1080 px container on large screens. */
const HALF = '(min-width: 1080px) 600px, (min-width: 1024px) 58vw, calc(100vw - 32px)'

const container = 'mx-auto w-full max-w-app px-4 sm:px-6 lg:px-8'

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-border bg-surface">
        <div className={cn(container, 'flex h-14 items-center justify-between gap-3')}>
          <Wordmark />
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <a href="#companies" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden sm:inline-flex')}>
              For companies
            </a>
            <LandingSessionActions primaryClass={buttonVariants({ size: 'sm' })} ghostClass={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'text-text')} />
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className={cn(container, 'pt-16 pb-14 sm:pt-24 sm:pb-20')}>
          <div className="grid max-w-reading gap-6">
            <p className="text-small font-medium text-accent">For FIRST® Tech Challenge teams and the companies that sponsor them</p>
            <h1 className="text-h1 font-semibold tracking-tighter text-balance text-text sm:text-display lg:text-display-lg">
              Sponsorship pitches companies actually read.
            </h1>
            <p className="text-lead text-text-secondary">
              Companies on FTC Pitfund are already looking for robotics teams to support. Upload your team’s deck once, answer each
              sponsor’s own questions, and every pitch is checked by a real person before it lands.
            </p>
            <div className="flex flex-col gap-3 pt-2 min-[420px]:flex-row">
              <Link href="/login?intent=team" prefetch={false} className={buttonVariants({ size: 'lg' })}>
                I coach a team
              </Link>
              <Link href="/login?intent=company" prefetch={false} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                I represent a company
              </Link>
            </div>
          </div>
          <Screenshot
            src={composerShot}
            alt="The pitch composer: a team answers a company’s questions, with the pitch preview beside it."
            className="mt-14 sm:mt-20"
            preload
          />
        </section>

        <section id="how" aria-labelledby="how-heading" className="scroll-mt-4 border-t border-border bg-canvas">
          <div className={cn(container, 'py-16 sm:py-24')}>
            <SectionHeading id="how-heading" title="How it works" body="Teams pitch companies that want to hear from them. A reviewer sits in between." />
            <div className="mt-12 grid gap-14 lg:grid-cols-2 lg:gap-12">
              <Steps heading="For teams" steps={teamSteps} />
              <Steps heading="For companies" steps={companySteps} />
            </div>
          </div>
        </section>

        <section aria-labelledby="team-page-heading" className="border-t border-border">
          <div className={cn(container, 'grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14')}>
            <div className="grid content-start gap-4">
              <SectionHeading
                id="team-page-heading"
                title="A public page for every team"
                body="Your deck, summary and logo live on one public page you can share anywhere. Companies you pitch see the same page next to your answers."
              />
              <p className="text-body text-text-secondary">
                Team numbers are checked against FIRST records, so companies know they are hearing from a real team.
              </p>
            </div>
            <Screenshot sizes={HALF} src={teamPageShot} alt="A public team page with the team’s summary, details and sponsorship deck." />
          </div>
        </section>

        <section id="companies" aria-labelledby="companies-heading" className="scroll-mt-4 border-t border-border bg-canvas">
          <div className={cn(container, 'py-16 sm:py-24')}>
            <SectionHeading
              id="companies-heading"
              title="What companies get"
              body="Pitches from FTC teams, answering your questions, already screened. One inbox, one click to connect."
            />
            <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
              <Screenshot sizes={HALF} src={inboxShot} alt="A pitch in a company’s inbox: the team, its answers, its deck, and Interested or Not a fit." />
              <ul className="grid border-t border-border">
                {companyBenefits.map((item) => (
                  <li key={item.title} className="grid gap-1 border-b border-border py-5">
                    <h3 className="text-body font-semibold text-text">{item.title}</h3>
                    <p className="text-body text-text-secondary">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-10">
              <Link href="/login?intent=company" prefetch={false} className={buttonVariants({ size: 'lg' })}>
                Set up your company
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="border-t border-border">
          <div className={cn(container, 'grid gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14')}>
            <SectionHeading id="faq-heading" title="Questions" body={<>Something else? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-accent underline-offset-4 hover:text-accent-hover hover:underline">{SUPPORT_EMAIL}</a>.</>} />
            <div className="border-t border-border">
              {faqs.map((item) => (
                <details key={item.q} className="group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-control py-4 text-lead font-medium text-text marker:content-none hover:text-accent [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 text-text-tertiary transition-transform duration-120 group-open:rotate-45">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <p className="max-w-reading pb-5 text-body text-text-secondary">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="start-heading" className="border-t border-border bg-canvas">
          <div className={cn(container, 'flex flex-col gap-6 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20')}>
            <div className="grid gap-2">
              <h2 id="start-heading" className="text-h2 font-semibold tracking-tighter text-text">
                Pitch the companies that want to hear from you.
              </h2>
              <p className="text-body text-text-secondary">Free for teams and companies. Sign in with Google or an email code.</p>
            </div>
            <div className="flex flex-col gap-3 min-[420px]:flex-row">
              <Link href="/login?intent=team" prefetch={false} className={buttonVariants({ size: 'lg' })}>
                I coach a team
              </Link>
              <Link href="/login?intent=company" prefetch={false} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                I represent a company
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={cn(container, 'grid gap-6 py-10 text-small text-text-tertiary')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Wordmark />
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/login" prefetch={false} className="hover:text-text">
                Sign in
              </Link>
              <Link href="/legal/terms" prefetch={false} className="hover:text-text">
                Terms
              </Link>
              <Link href="/legal/privacy" prefetch={false} className="hover:text-text">
                Privacy
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-text">
                {SUPPORT_EMAIL}
              </a>
            </nav>
          </div>
          <div className="grid gap-1.5 border-t border-border pt-6">
            <p>
              Built by Anish Yarrakonda · Idea by Rishi Jhaveri (outreach lead) and Shreyas Vempati (team captain) · FTC Team 31579 Exodius
            </p>
            <p>© 2026 FTC Pitfund · {FIRST_DISCLAIMER}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({ id, title, body }: { id: string; title: string; body: ReactNode }) {
  return (
    <div className="grid max-w-reading content-start gap-3">
      <h2 id={id} className="text-h2 font-semibold tracking-tighter text-text sm:text-h1">
        {title}
      </h2>
      <p className="text-lead text-text-secondary">{body}</p>
    </div>
  )
}

function Screenshot({
  src,
  alt,
  className,
  preload = false,
  sizes = '(min-width: 1080px) 1016px, calc(100vw - 32px)',
}: {
  src: StaticImageData
  alt: string
  className?: string
  preload?: boolean
  sizes?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-dialog border border-border bg-canvas', className)}>
      <Image
        src={src}
        alt={alt}
        sizes={sizes}
        preload={preload}
        fetchPriority={preload ? 'high' : undefined}
        loading={preload ? 'eager' : 'lazy'}
        quality={80}
        className="h-auto w-full"
      />
    </div>
  )
}

function Steps({ heading, steps }: { heading: string; steps: Array<{ title: string; body: string }> }) {
  return (
    <div className="grid content-start gap-5">
      <h3 className="text-h3 font-semibold tracking-tight text-text">{heading}</h3>
      <ol className="grid border-t border-border">
        {steps.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-border py-5">
            <span className="text-body text-text-tertiary tabular">{String(i + 1).padStart(2, '0')}</span>
            <div className="grid gap-1">
              <h4 className="text-body font-semibold text-text">{step.title}</h4>
              <p className="text-body text-text-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
