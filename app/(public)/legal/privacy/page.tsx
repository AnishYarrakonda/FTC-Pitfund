import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalPage, type LegalSection } from '@/components/app/legal-page'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What FTC Pitfund collects, who can see it, which services process it, and how to delete it.',
  alternates: { canonical: '/legal/privacy' },
}

const email = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>

/* Plain-language draft. Have a qualified person review before launch (docs/LAUNCH.md step 8). */
const SECTIONS: LegalSection[] = [
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <h3>About you</h3>
        <ul>
          <li>Your email address and name.</li>
          <li>If you sign in with Google: the name, email address and profile photo link Google shares with us.</li>
          <li>Your phone number and, for company members, your job title, only if you add them.</li>
          <li>When you accepted these terms, and whether your account is suspended.</li>
        </ul>
        <h3>About your team</h3>
        <ul>
          <li>Team number, name, city, state, country, website, one-line summary and logo.</li>
          <li>
            Your sponsorship deck (a PDF) and a preview image of its first page, plus the date you confirmed you have permission to share
            photos of the people in it.
          </li>
          <li>
            <strong>The screenshot of your FIRST® Dashboard</strong> that you upload to show you coach the team. It is kept in private
            storage, never appears on the site, and is deleted as soon as an admin has approved the team.
          </li>
          <li>
            The team’s public record from FIRST®, looked up by team number, and whether we have verified the team. Lookups are saved so we
            don’t have to repeat them.
          </li>
          <li>Who is a member and which of them owns the account, requests to join, and invites (the invited email address).</li>
        </ul>
        <h3>About your company</h3>
        <ul>
          <li>Company name, website, logo, location, what you look for, the kinds of support you offer, and your questions for teams.</li>
          <li>When you apply: your job title and, if you give it, a LinkedIn profile link.</li>
          <li>Who is a member and which of them owns the account, and invites (the invited email address).</li>
        </ul>
        <h3>Pitches and activity</h3>
        <ul>
          <li>
            Pitches: your answers, any support you ask for, and every step (sent, reviewed, sent back, answered, withdrawn), with notes from
            our reviewers and a company’s reason if it gives one.
          </li>
          <li>On a match, a copy of each side’s contact details at that moment.</li>
          <li>In-app notifications, and a record of the emails we send you.</li>
          <li>
            An activity log of important actions (who did what, and when) so we can show a pitch’s history and look into problems.
          </li>
        </ul>
        <h3>Reports</h3>
        <ul>
          <li>
            If you report a team page: the reason, any details you write, and your email address if you are signed in or choose to give it.
          </li>
        </ul>
        <p>We don’t collect passwords, student accounts, government IDs, payment details or your precise location.</p>
      </>
    ),
  },
  {
    id: 'who-can-see-what',
    title: 'Who can see what',
    body: (
      <>
        <h3>Anyone on the internet</h3>
        <ul>
          <li>
            <strong>Team pages</strong> at addresses like <code>/t/31579</code>: team number, name, city, state, website, summary, logo,
            verified checkmark and the <strong>sponsorship deck</strong>. Search engines can find them. Team member names, emails and phone
            numbers never appear there.
          </li>
          <li>Uploaded logos, decks and deck previews are stored at public web addresses that are hard to guess.</li>
        </ul>
        <h3>Signed-in team members</h3>
        <ul>
          <li>The profiles and questions of approved companies. Companies waiting for approval are hidden from teams.</li>
          <li>Their own team’s members, pitches and notifications.</li>
        </ul>
        <h3>The company you pitch, after we approve the pitch</h3>
        <ul>
          <li>
            Your pitch answers, what you ask for, and your team page. The company never sees a pitch we haven’t approved, or any pitch to
            another company.
          </li>
        </ul>
        <h3>Only the two sides of a match</h3>
        <ul>
          <li>
            When a company marks a pitch Interested, the team receives the name, email, phone (if added) and job title of the company member
            who answered. The company receives the name, email and phone (if added) of the coach who sent the pitch, or another team member
            if that coach has left. Nobody else can see these details.
          </li>
        </ul>
        <h3>FTC Pitfund admins</h3>
        <ul>
          <li>
            A small group of our volunteers can see everything above, including member lists, pending teams and companies, every pitch,
            reports, the activity log and the email log, so they can review pitches, approve organizations and keep the site safe.
          </li>
          <li>
            Your FIRST® Dashboard screenshot is the one thing that isn’t stored in the open: an admin opens it through a link that stops
            working after 15 minutes, and only while the team is still being reviewed.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'services',
    title: 'Services that process your data',
    body: (
      <>
        <p>We use these providers to run FTC Pitfund. They handle data only to provide their service to us.</p>
        <ul>
          <li>
            <strong>Supabase</strong>: database, sign-in and file storage.
          </li>
          <li>
            <strong>Vercel</strong>: hosting the site, and a bot check on the sign-in and report forms.
          </li>
          <li>
            <strong>Resend</strong>: sending email.
          </li>
          <li>
            <strong>Sentry</strong>: error reports, with email addresses, sign-in codes, cookies and form contents removed before they are
            sent.
          </li>
          <li>
            <strong>Google</strong>: signing in, if you choose “Continue with Google”.
          </li>
          <li>
            <strong>FTCScout and the FIRST® Events API</strong>: looking up a team’s public record. We send only the team number.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'email',
    title: 'Email',
    body: (
      <>
        <p>We send only email about your account and activity:</p>
        <ul>
          <li>Sign-in codes.</li>
          <li>Invites, join requests, and updates on pitches and company approval, which also appear in the app.</li>
          <li>For admins, alerts about new pitches and reports, and a daily summary.</li>
        </ul>
        <p>
          We don’t send marketing or newsletters, and we don’t share your email address for anyone else’s marketing. Sign-in codes and invite
          links are erased from our email log once sent.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and tracking',
    body: (
      <p>
        We use cookies only to keep you signed in. We don’t use analytics, advertising or tracking cookies, and we don’t follow you around
        other sites. While you write a pitch, your browser may keep a temporary copy of your draft until it is saved; it is gone when you
        close the tab.
      </p>
    ),
  },
  {
    id: 'keeping-and-deleting',
    title: 'How long we keep data, and deleting it',
    body: (
      <>
        <p>We keep your data while your account, team or company is active. You can delete your account from the Account page.</p>
        <h3>Deleting your account removes</h3>
        <ul>
          <li>Your sign-in, name, email, profile photo link, phone number and job title.</li>
          <li>Your team or company membership, your join requests and your notifications.</li>
        </ul>
        <h3>What stays</h3>
        <ul>
          <li>
            Your team or company, and what it shares, because other members still use it. If you own it, hand it to another member first; if
            you are its only member, invite someone else or email {email} to close it.
          </li>
          <li>
            Pitches, decisions and the activity log, with your name removed from them. Contact details already shared on a match stay with
            the other side, as do emails already delivered.
          </li>
          <li>Our record of emails sent to your address, which we need to stay within our daily sending limit.</li>
        </ul>
        <p>
          When you replace a deck or logo, the old file is deleted. Your FIRST® Dashboard screenshot is deleted when the team is approved.
          Uploads that were never finished are deleted within two days. To delete a team, a company or anything else, email {email}.
        </p>
      </>
    ),
  },
  {
    id: 'we-dont-sell',
    title: 'We don’t sell your data',
    body: (
      <p>We never sell or rent personal information, and we don’t share it except as this page describes or when the law requires it.</p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        FTC Pitfund is for adults 18 and older. We don’t knowingly collect data from anyone younger, and there are no student accounts. If
        you think someone under 18 has signed up, or a deck shows a young person without permission, email {email} and we will remove it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change what we collect or how we share it, we will update this page and the date at the top, and tell you in the app or by
        email for important changes. See also our <Link href="/legal/terms">Terms</Link>.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <p>Questions, or a request to see, correct or delete your data: {email}.</p>,
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="September 19, 2026"
      intro={
        <p>
          FTC Pitfund collects only what it needs to connect FTC teams with sponsors. This page lists what we keep, who can see it, and how
          to delete it. FTC Pitfund is run by volunteers from FIRST® Tech Challenge Team 31579 Exodius (“we”).
        </p>
      }
      sections={SECTIONS}
      other={{ href: '/legal/terms', title: 'Terms', description: 'The rules for using FTC Pitfund, and what we promise each other.' }}
    />
  )
}
