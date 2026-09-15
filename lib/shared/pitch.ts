import { formatMoney } from './format'
import type { Question } from './questions'
import type { PitchStatus } from './types'

/* Coach-side pitch rules shared by the composer (browser) and the pitch actions (server). */

export type AskType = 'none' | 'amount' | 'in_kind' | 'open'
export type Ask = { type: AskType; amountDollars: number | null; note: string | null }
export type DraftAnswer = { questionId: string; prompt: string; answer: string }

/** Everything PitchView renders: the pitch exactly as the company sees it. */
export type PitchViewData = {
  team: {
    number: number
    name: string
    city: string | null
    state: string | null
    summary: string | null
    website: string | null
    logoUrl: string | null
    verified: boolean
    deck: { url: string; thumbUrl: string | null; pages: number } | null
  }
  company: { id: string; name: string; logoUrl: string | null }
  answers: DraftAnswer[]
  ask: { type: AskType; amountCents: number | null; note: string | null; label: string | null }
  submittedAt: Date | null
}

export const MAX_ASK_DOLLARS = 1_000_000
export const MAX_ASK_NOTE = 500

export const ASK_OPTIONS: Array<{ value: AskType; label: string }> = [
  { value: 'none', label: 'No ask' },
  { value: 'amount', label: 'Amount' },
  { value: 'in_kind', label: 'In-kind' },
  { value: 'open', label: 'Open to discuss' },
]

export const EDITABLE_STATUSES: PitchStatus[] = ['draft', 'changes_requested']
export const WITHDRAWABLE_STATUSES: PitchStatus[] = ['in_review', 'changes_requested', 'sent']

export function isEditable(status: PitchStatus) {
  return EDITABLE_STATUSES.includes(status)
}

export function isWithdrawable(status: PitchStatus) {
  return WITHDRAWABLE_STATUSES.includes(status)
}

export type PitchGroup = 'attention' | 'progress' | 'matched' | 'closed'

export const PITCH_GROUPS: Array<{ key: PitchGroup; title: string; statuses: PitchStatus[] }> = [
  { key: 'attention', title: 'Needs your attention', statuses: ['changes_requested', 'draft'] },
  { key: 'progress', title: 'In progress', statuses: ['in_review', 'sent'] },
  { key: 'matched', title: 'Matched', statuses: ['matched'] },
  { key: 'closed', title: 'Closed', statuses: ['rejected', 'declined', 'withdrawn'] },
]

/** The one-line next step shown on pitch rows and the pitch header. */
export function nextStep(status: PitchStatus, company: string): string {
  switch (status) {
    case 'draft':
      return 'Finish your answers and submit'
    case 'changes_requested':
      return 'Edit and resubmit'
    case 'in_review':
      return 'Waiting for Pitfund review, usually within a day'
    case 'sent':
      return `Waiting for ${company}`
    case 'matched':
      return `You’re connected with ${company}`
    case 'rejected':
      return 'A reviewer didn’t approve this pitch'
    case 'declined':
      return `${company} isn’t a fit this time`
    case 'withdrawn':
      return 'You withdrew this pitch'
  }
}

/** What a directory card and company page show for this team's pitch this season. */
export type DirectoryState =
  | { kind: 'start' }
  | { kind: 'pitch'; pitchId: string; status: PitchStatus; label: string; href: string }

export function directoryState(sponsorId: string, pitch: { id: string; status: PitchStatus } | null | undefined): DirectoryState {
  if (!pitch || pitch.status === 'withdrawn') return { kind: 'start' }
  const labels: Record<Exclude<PitchStatus, 'withdrawn'>, string> = {
    draft: 'Continue draft',
    in_review: 'In review',
    changes_requested: 'Needs changes',
    sent: 'Sent',
    matched: 'Matched',
    rejected: 'Pitched this season',
    declined: 'Pitched this season',
  }
  const href = isEditable(pitch.status) ? `/sponsors/${sponsorId}/pitch` : `/pitches/${pitch.id}`
  return { kind: 'pitch', pitchId: pitch.id, status: pitch.status, label: labels[pitch.status], href }
}

export function formatAsk(ask: { type: AskType; amountCents: number | null; note: string | null }): string | null {
  switch (ask.type) {
    case 'amount':
      return ask.amountCents !== null ? formatMoney(ask.amountCents) : 'An amount to discuss'
    case 'in_kind':
      return 'In-kind support'
    case 'open':
      return 'Open to discuss'
    default:
      return null
  }
}

/**
 * Merge saved answers onto the company's current questions. Answers are keyed by question
 * id; answers to removed questions are dropped. `changed` is true when the question set the
 * draft was saved against differs from today's (ids added/removed or prompts edited).
 */
export function mergeAnswers(questions: Question[], saved: DraftAnswer[]) {
  const byId = new Map(saved.map((a) => [a.questionId, a]))
  const answers = questions.map((q) => ({ questionId: q.id, prompt: q.prompt, answer: byId.get(q.id)?.answer ?? '' }))
  const changed =
    saved.length > 0 &&
    (saved.length !== questions.length ||
      saved.some((a) => {
        const q = questions.find((x) => x.id === a.questionId)
        return !q || q.prompt !== a.prompt
      }))
  return { answers, changed }
}

export type Blocker = { key: 'deck' | 'summary' | 'answer' | 'ask'; message: string; href?: string; questionId?: string }

/** Why Submit is disabled. Empty means ready. Each reason links to or focuses its fix. */
export function submitBlockers(input: {
  hasDeck: boolean
  hasSummary: boolean
  questions: Question[]
  answers: Array<{ questionId: string; answer: string }>
  ask: Ask
}): Blocker[] {
  const blockers: Blocker[] = []
  if (!input.hasDeck) blockers.push({ key: 'deck', message: 'Upload your sponsorship deck', href: '/team#deck' })
  if (!input.hasSummary) blockers.push({ key: 'summary', message: 'Add your team’s one-line summary', href: '/team#profile' })
  const byId = new Map(input.answers.map((a) => [a.questionId, a.answer]))
  for (const [index, q] of input.questions.entries()) {
    if (q.required && !(byId.get(q.id) ?? '').trim()) {
      blockers.push({ key: 'answer', message: `Answer question ${index + 1}`, questionId: q.id })
    }
  }
  if (input.ask.type === 'amount' && !input.ask.amountDollars) blockers.push({ key: 'ask', message: 'Enter the amount you’re asking for' })
  if (input.ask.type === 'in_kind' && !input.ask.note?.trim()) blockers.push({ key: 'ask', message: 'Describe the in-kind support you’re asking for' })
  return blockers
}
