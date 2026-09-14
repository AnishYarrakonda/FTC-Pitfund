import type { Metadata } from 'next'

import { LegalPage } from '@/components/app/legal-page'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

export const metadata: Metadata = { title: 'Privacy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="September 13, 2026">
      <section>
        <p>FTC Pitfund collects as little as it can. This page lists everything we keep and why.</p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your name and email, from Google or the email address you sign in with.</li>
          <li>Your phone number and job title, only if you add them.</li>
          <li>What your team or company adds: team details, a sponsorship deck, company questions and pitches.</li>
          <li>We don&apos;t collect student accounts, passwords, government IDs or payment details.</li>
        </ul>
      </section>
      <section>
        <h2>Who sees it</h2>
        <ul>
          <li>Team profile pages and decks are public.</li>
          <li>A pitch is seen by FTC Pitfund reviewers, and by the company only after a reviewer approves it.</li>
          <li>Contact details are shared only when a company says it&apos;s interested in a pitch, and only with the two sides involved.</li>
        </ul>
      </section>
      <section>
        <h2>Services we use</h2>
        <p>Supabase (database, sign-in and files), Vercel (hosting), Resend (email) and Sentry (error reports, with personal details removed).</p>
      </section>
      <section>
        <h2>Deleting your data</h2>
        <p>You can delete your account from the Account page at any time. For anything else, email {SUPPORT_EMAIL}.</p>
      </section>
    </LegalPage>
  )
}
