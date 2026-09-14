import type { Metadata } from 'next'

import { LegalPage } from '@/components/app/legal-page'
import { FIRST_DISCLAIMER, SUPPORT_EMAIL } from '@/lib/shared/brand'

export const metadata: Metadata = { title: 'Terms' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="September 13, 2026">
      <section>
        <p>
          FTC Pitfund connects FIRST® Tech Challenge teams with companies that sponsor robotics teams. By using it you agree to these
          terms. {FIRST_DISCLAIMER}
        </p>
      </section>
      <section>
        <h2>Who can use FTC Pitfund</h2>
        <ul>
          <li>You must be 18 or older. Students don&apos;t create accounts; their coaches and mentors do.</li>
          <li>Teams and companies each have one shared account. Everyone on it can do everything the account can do.</li>
          <li>Only pitch for a team you coach or mentor, and only represent a company you work for.</li>
        </ul>
      </section>
      <section>
        <h2>Pitches and matches</h2>
        <ul>
          <li>An FTC Pitfund reviewer reads every pitch before a company sees it, and may send it back or decline it.</li>
          <li>When a company says it&apos;s interested, both sides receive each other&apos;s name, email and, if provided, phone number.</li>
          <li>FTC Pitfund never handles money. Any sponsorship is agreed and paid directly between the team and the company.</li>
        </ul>
      </section>
      <section>
        <h2>Your content</h2>
        <ul>
          <li>Team profiles and decks are public web pages. Only upload what you have permission to share, including photos of people.</li>
          <li>We may remove content or suspend accounts that are misleading, abusive or break these terms.</li>
        </ul>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about these terms: {SUPPORT_EMAIL}.</p>
      </section>
    </LegalPage>
  )
}
