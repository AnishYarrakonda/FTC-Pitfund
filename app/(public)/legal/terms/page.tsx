import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalPage } from '@/components/app/legal-page'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The rules for using FTC Pitfund: who can sign up, how pitches and matches work, and what we do and don’t do.',
  alternates: { canonical: '/legal/terms' },
}

const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>

export default function TermsPage() {
  return (
    <>
      {/* Plain-language draft. Have a qualified person review before launch. */}
      <LegalPage
        title="Terms"
        updated="September 14, 2026"
        intro={<p>These terms explain the rules for using FTC Pitfund. By creating an account or using the site, you agree to them.</p>}
      >
        <section>
          <h2>Who runs FTC Pitfund</h2>
          <p>
            FTC Pitfund is run by volunteers from FIRST® Tech Challenge Team 31579 Exodius. It is free to use. It connects FTC teams with
            companies that want to sponsor robotics teams.
          </p>
          <p>
            <strong>FTC Pitfund is not affiliated with or endorsed by FIRST®.</strong> FIRST® and FIRST® Tech Challenge are trademarks of
            their owner, used here only to describe who the site is for.
          </p>
        </section>

        <section>
          <h2>Who can use it</h2>
          <ul>
            <li>
              <strong>You must be 18 or older.</strong> There are no student accounts. Coaches, mentors and parents who handle sponsorship
              sign up for a team; employees sign up for a company.
            </li>
            <li>Only join a team you actually coach or mentor, and only represent a company you work for or are allowed to speak for.</li>
            <li>You can belong to one team or one company at a time.</li>
            <li>You sign in with Google or a 6-digit code sent to your email. Keep access to that email account secure.</li>
          </ul>
        </section>

        <section>
          <h2>Shared team and company accounts</h2>
          <p>
            Each team and each company has one shared account. Everyone on it is an equal member: any member can edit the profile, upload
            files, invite or approve new members, and write, send or withdraw pitches (or answer them, for a company). There are no owners or
            permission levels, so only let in people you trust. Everything a member does is done on behalf of the whole team or company.
          </p>
        </section>

        <section>
          <h2>What FTC Pitfund does</h2>
          <ul>
            <li>
              Teams set up a public team page with a one-line summary and a sponsorship deck (one PDF, up to 5 pages and 10 MB), then pitch
              companies by answering each company’s own questions.
            </li>
            <li>
              <strong>We review every company before teams can see it.</strong> A company stays hidden until we approve it.
            </li>
            <li>
              <strong>We review every pitch before the company sees it.</strong> We may send a pitch back for changes or decline to pass it
              on.
            </li>
            <li>
              When a company marks a pitch <strong>Interested</strong>, both sides receive each other’s contact details and continue the
              conversation directly. A company may also answer <strong>Not a fit</strong>.
            </li>
            <li>
              <strong>One pitch per team, per company, per season.</strong> A season runs from September 1 to August 31. If you withdraw a
              pitch before the company answers, you can pitch that company again the same season. A pitch we declined or the company marked
              Not a fit still counts.
            </li>
          </ul>
        </section>

        <section>
          <h2>What FTC Pitfund doesn’t do</h2>
          <ul>
            <li>
              <strong>We never handle money.</strong> Any sponsorship, donation, equipment or other support is agreed and delivered directly
              between the team and the company, on terms they set.
            </li>
            <li>
              <strong>We don’t guarantee sponsorship.</strong> Approving a pitch means it meets our standards, not that the company will say
              yes. Companies decide for themselves.
            </li>
            <li>
              We don’t check every claim a team or company makes. A verified checkmark means we looked into the team, not that we vouch for
              everything it says. Do your own checks before you commit to anything.
            </li>
            <li>We don’t provide messaging, contracts, tax receipts or legal advice.</li>
          </ul>
        </section>

        <section>
          <h2>Your responsibilities</h2>
          <ul>
            <li>Give accurate information about yourself, your team or your company, and keep it up to date.</li>
            <li>
              Only upload decks, logos and text you have the right to share. <strong>Get permission from everyone shown in photos</strong>{' '}
              in your deck, and from a parent or guardian for anyone under 18. You confirm this when you upload a deck.
            </li>
            <li>Don’t pretend to be another person, team or company, or suggest a connection that doesn’t exist.</li>
            <li>
              Don’t send spam, harass anyone, upload anything harmful or illegal, or use contact details you receive for anything other than
              the sponsorship conversation.
            </li>
            <li>Don’t try to break, overload, scrape or get around the security of the site.</li>
          </ul>
        </section>

        <section>
          <h2>Your content</h2>
          <p>
            You keep ownership of what you upload. You give FTC Pitfund permission to store it, show it and share it as the site describes:
            team pages and decks are public, pitches go to the company you chose after review, and contact details go to the other side on a
            match. This permission ends when the content is deleted, except for copies the other side already received.
          </p>
        </section>

        <section>
          <h2>Reports, removal and suspension</h2>
          <p>
            Anyone can report a team page that looks wrong, misleading or inappropriate, and we read every report. We may edit or remove
            content, decline pitches, reject or suspend a company, or suspend a person or team that breaks these terms or puts others at
            risk, with or without notice. If you think we got something wrong, email {email}.
          </p>
        </section>

        <section>
          <h2>Leaving</h2>
          <p>
            You can delete your account from the Account page at any time. If you are the only member of a team or company, invite someone
            else first or email {email} to close it. The <Link href="/legal/privacy">Privacy Policy</Link> explains what is deleted and what
            stays.
          </p>
        </section>

        <section>
          <h2>No warranty</h2>
          <p>
            FTC Pitfund is a free, volunteer-run service provided as it is. It may have bugs, be unavailable at times, or delay emails. To the
            extent the law allows, the people who run FTC Pitfund are not responsible for any loss that comes from using it, including a
            sponsorship that doesn’t happen or doesn’t go as agreed.
          </p>
        </section>

        <section>
          <h2>Changes to these terms</h2>
          <p>
            We may update these terms as the site changes. We will change the date at the top, and for important changes we will also tell
            you in the app or by email. If you keep using FTC Pitfund after a change, you accept the new terms.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>Questions about these terms: {email}.</p>
        </section>
      </LegalPage>
    </>
  )
}
