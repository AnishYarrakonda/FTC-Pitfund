import Link from 'next/link'

import { PublicFooter, PublicHeader } from '@/components/app/public-chrome'
import { Button } from '@/components/ui/button'

/*
 * Landing page (plan §1 "The pitch"). Prompt 4 builds the full page (how it works, FAQ, SEO);
 * this is the static first version with the approved positioning.
 */

const teamSteps = [
  { title: 'Upload your deck once', body: 'One PDF, up to five pages, plus a one-line summary. It becomes your team’s public page.' },
  { title: 'Answer each company’s questions', body: 'Companies on FTC Pitfund already sponsor teams, and they tell you exactly what they want to know.' },
  { title: 'A real person checks every pitch', body: 'A reviewer reads your pitch before the company sees it, and sends it back with a note if it needs work.' },
]

const companySteps = [
  { title: 'Ask your own questions', body: 'Up to ten. Every pitch you receive answers them.' },
  { title: 'Only screened pitches', body: 'Every pitch is reviewed before it reaches your inbox.' },
  { title: 'One click to connect', body: 'Say you’re interested and you both get each other’s contact details.' },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <PublicHeader
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      />
      <main id="main" className="flex-1">
        <section className="mx-auto w-full max-w-app px-4 pt-20 pb-20 sm:px-6 sm:pt-28 lg:px-8">
          <div className="grid max-w-reading gap-6">
            <p className="text-small font-medium text-accent">For FIRST® Tech Challenge teams and the companies that sponsor them</p>
            <h1 className="text-h1 font-semibold tracking-tighter text-text sm:text-display">Sponsorship pitches companies actually read.</h1>
            <p className="text-lead text-text-secondary">
              Companies on FTC Pitfund are already looking for robotics teams to support. Upload your team&apos;s deck once, answer each
              sponsor&apos;s own questions, and every pitch is checked by a real person before it lands.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg">
                <Link href="/login">Start your team&apos;s profile</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">I represent a company</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-canvas">
          <div className="mx-auto grid w-full max-w-app gap-16 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
            <Steps heading="For teams" steps={teamSteps} />
            <Steps heading="For companies" steps={companySteps} intro="Pitches from FTC teams, answering your questions, already screened." />
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}

function Steps({ heading, steps, intro }: { heading: string; steps: Array<{ title: string; body: string }>; intro?: string }) {
  return (
    <div className="grid content-start gap-6">
      <div className="grid gap-2">
        <h2 className="text-h3 font-semibold tracking-tight text-text">{heading}</h2>
        {intro ? <p className="text-body text-text-secondary">{intro}</p> : null}
      </div>
      <ol className="grid border-t border-border">
        {steps.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[32px_1fr] gap-3 border-b border-border py-5">
            <span className="text-body text-text-tertiary tabular">{String(i + 1).padStart(2, '0')}</span>
            <div className="grid gap-1">
              <h3 className="text-body font-semibold text-text">{step.title}</h3>
              <p className="text-body text-text-secondary">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
