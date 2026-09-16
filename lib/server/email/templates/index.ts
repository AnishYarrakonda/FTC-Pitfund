import 'server-only'

import { render, toPlainText } from 'react-email'
import { createElement, type ComponentType } from 'react'

import AdminDigestEmail, { adminDigestSchema, adminDigestSubject } from './admin-digest'
import AdminNewPitchEmail, { adminNewPitchSchema, adminNewPitchSubject } from './admin-new-pitch'
import AdminReportEmail, { adminReportSchema, adminReportSubject } from './admin-report'
import JoinDecisionEmail, { joinDecisionSchema, joinDecisionSubject } from './join-decision'
import JoinRequestEmail, { joinRequestSchema, joinRequestSubject } from './join-request'
import LoginCodeEmail, { loginCodeSchema, loginCodeSubject } from './login-code'
import MatchSponsorEmail, { matchSponsorSchema, matchSponsorSubject } from './match-sponsor'
import MatchTeamEmail, { matchTeamSchema, matchTeamSubject } from './match-team'
import NewPitchSponsorEmail, { newPitchSponsorSchema, newPitchSponsorSubject } from './new-pitch-sponsor'
import NoticeEmail, { noticeSchema } from './notice'
import PitchApprovedCoachEmail, { pitchApprovedCoachSchema, pitchApprovedCoachSubject } from './pitch-approved-coach'
import PitchNotAFitEmail, { pitchNotAFitSchema, pitchNotAFitSubject } from './pitch-not-a-fit'
import PitchRejectedEmail, { pitchRejectedSchema, pitchRejectedSubject } from './pitch-rejected'
import PitchSentBackEmail, { pitchSentBackSchema, pitchSentBackSubject } from './pitch-sent-back'
import PitchWithdrawnEmail, { pitchWithdrawnSchema, pitchWithdrawnSubject } from './pitch-withdrawn'
import SponsorApprovedEmail, { sponsorApprovedSchema, sponsorApprovedSubject } from './sponsor-approved'
import TeamApprovedEmail, { teamApprovedSchema, teamApprovedSubject } from './team-approved'
import TeamRejectedEmail, { teamRejectedSchema, teamRejectedSubject } from './team-rejected'
import SponsorInviteEmail, { sponsorInviteSchema, sponsorInviteSubject } from './sponsor-invite'
import SponsorRejectedEmail, { sponsorRejectedSchema, sponsorRejectedSubject } from './sponsor-rejected'
import TeamInviteEmail, { teamInviteSchema, teamInviteSubject } from './team-invite'

/*
 * Template registry. The outbox stores `template` + `payload`; rendering happens at send
 * time so a queued email always uses the current template. Add a template: create the
 * component + zod schema, then register it here.
 */

const registry = {
  'login-code': {
    schema: loginCodeSchema,
    subject: loginCodeSubject,
    component: LoginCodeEmail,
    // The code is scrubbed from the outbox row once the email is sent or has failed.
    sensitive: true,
  },
  notice: {
    schema: noticeSchema,
    subject: (p: { subject: string }) => p.subject,
    component: NoticeEmail,
    sensitive: false,
  },
  'team-invite': {
    schema: teamInviteSchema,
    subject: teamInviteSubject,
    component: TeamInviteEmail,
    // The accept link carries the invite token; it is scrubbed once the email is sent.
    sensitive: true,
  },
  'join-request': { schema: joinRequestSchema, subject: joinRequestSubject, component: JoinRequestEmail, sensitive: false },
  'join-decision': { schema: joinDecisionSchema, subject: joinDecisionSubject, component: JoinDecisionEmail, sensitive: false },
  'admin-new-pitch': { schema: adminNewPitchSchema, subject: adminNewPitchSubject, component: AdminNewPitchEmail, sensitive: false },
  'pitch-withdrawn': { schema: pitchWithdrawnSchema, subject: pitchWithdrawnSubject, component: PitchWithdrawnEmail, sensitive: false },
  'match-team': { schema: matchTeamSchema, subject: matchTeamSubject, component: MatchTeamEmail, sensitive: false },
  'match-sponsor': { schema: matchSponsorSchema, subject: matchSponsorSubject, component: MatchSponsorEmail, sensitive: false },
  'pitch-not-a-fit': { schema: pitchNotAFitSchema, subject: pitchNotAFitSubject, component: PitchNotAFitEmail, sensitive: false },
  'pitch-approved-coach': { schema: pitchApprovedCoachSchema, subject: pitchApprovedCoachSubject, component: PitchApprovedCoachEmail, sensitive: false },
  'new-pitch-sponsor': { schema: newPitchSponsorSchema, subject: newPitchSponsorSubject, component: NewPitchSponsorEmail, sensitive: false },
  'pitch-sent-back': { schema: pitchSentBackSchema, subject: pitchSentBackSubject, component: PitchSentBackEmail, sensitive: false },
  'pitch-rejected': { schema: pitchRejectedSchema, subject: pitchRejectedSubject, component: PitchRejectedEmail, sensitive: false },
  'sponsor-approved': { schema: sponsorApprovedSchema, subject: sponsorApprovedSubject, component: SponsorApprovedEmail, sensitive: false },
  'team-approved': { schema: teamApprovedSchema, subject: teamApprovedSubject, component: TeamApprovedEmail, sensitive: false },
  'team-rejected': { schema: teamRejectedSchema, subject: teamRejectedSubject, component: TeamRejectedEmail, sensitive: false },
  'sponsor-rejected': { schema: sponsorRejectedSchema, subject: sponsorRejectedSubject, component: SponsorRejectedEmail, sensitive: false },
  'sponsor-invite': {
    schema: sponsorInviteSchema,
    subject: sponsorInviteSubject,
    component: SponsorInviteEmail,
    // The accept link carries the invite token; it is scrubbed once the email is sent.
    sensitive: true,
  },
  'admin-report': { schema: adminReportSchema, subject: adminReportSubject, component: AdminReportEmail, sensitive: false },
  'admin-digest': { schema: adminDigestSchema, subject: adminDigestSubject, component: AdminDigestEmail, sensitive: false },
} as const

export type TemplateName = keyof typeof registry
export type TemplatePayload<T extends TemplateName> = Parameters<(typeof registry)[T]['component']>[0]

function isTemplateName(name: string): name is TemplateName {
  return name in registry
}

export function isSensitiveTemplate(name: string) {
  return isTemplateName(name) && registry[name].sensitive
}

export class TemplateError extends Error {}

/** The text part: every link URL on its own line, so it stays tappable in any mail client. */
function plainText(html: string) {
  return toPlainText(html)
    .replace(/[ \t]+(https?:\/\/\S+)/g, '\n$1')
    .replace(/(https?:\/\/\S+)[ \t]+/g, '$1\n')
}

export async function renderEmail(template: string, payload: unknown) {
  if (!isTemplateName(template)) throw new TemplateError(`Unknown email template "${template}"`)
  const entry = registry[template]
  const parsed = entry.schema.safeParse(payload)
  if (!parsed.success) throw new TemplateError(`Invalid payload for "${template}": ${parsed.error.message}`)
  const component = entry.component as ComponentType<Record<string, unknown>>
  const element = createElement(component, parsed.data as Record<string, unknown>)
  const html = await render(element)
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subject: (entry.subject as (p: any) => string)(parsed.data),
    html,
    text: plainText(html),
  }
}
