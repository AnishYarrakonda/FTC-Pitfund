import { ArrowUpRight, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { displayWebsite } from '@/lib/shared/url'

type Contact = { name: string; email: string; phone: string | null; jobTitle?: string | null; website?: string | null; teamUrl?: string | null }

/**
 * The "Connected" panel on a matched pitch (plan §3.2): the other side's name, title, email and
 * phone, and nothing else. Shared by the coach's pitch page and the company inbox.
 */
export function ConnectedPanel({ title, description, contact, contactLabel }: { title: ReactNode; description: ReactNode; contact: Contact; contactLabel?: string }) {
  return (
    <section aria-labelledby="connected-heading" className="grid gap-4 rounded-dialog border border-success/25 bg-success-subtle p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-success" />
        <div className="grid min-w-0 gap-1">
          <h2 id="connected-heading" className="text-lead font-semibold tracking-tight text-text user-text">
            {title}
          </h2>
          <p className="text-body text-text-secondary">{description}</p>
        </div>
      </div>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 sm:pl-8">
        <ContactRow label={contactLabel ?? 'Name'} value={contact.name} />
        {contact.jobTitle ? <ContactRow label="Title" value={<span className="line-clamp-3">{contact.jobTitle}</span>} /> : null}
        <ContactRow
          label="Email"
          value={
            <a href={`mailto:${contact.email}`} className="font-medium text-accent hover:text-accent-hover">
              {contact.email}
            </a>
          }
        />
        {contact.phone ? (
          <ContactRow
            label="Phone"
            value={
              <a href={`tel:${contact.phone}`} className="font-medium text-accent hover:text-accent-hover">
                {contact.phone}
              </a>
            }
          />
        ) : null}
        {contact.website ? <ContactRow label="Website" value={<ExternalLink href={contact.website}>{displayWebsite(contact.website)}</ExternalLink>} /> : null}
        {contact.teamUrl ? <ContactRow label="Team page" value={<ExternalLink href={contact.teamUrl}>{displayWebsite(contact.teamUrl)}</ExternalLink>} /> : null}
      </dl>
    </section>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1 font-medium text-accent hover:text-accent-hover">
      <span className="min-w-0 line-clamp-2">{children}</span>
      <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
    </a>
  )
}

function ContactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-small text-text-tertiary">{label}</dt>
      <dd className="min-w-0 text-body text-text user-text">{value}</dd>
    </div>
  )
}
