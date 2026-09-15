'use client'

import { Check, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { deleteDraftAction, saveDraftAction, submitPitchAction } from '@/app/actions/pitches'
import { PitchView } from '@/components/pitch/pitch-view'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/choice'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Banner } from '@/components/ui/banner'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { isNetworkError } from '@/lib/client/use-action'
import { useUnsavedChanges } from '@/lib/client/use-unsaved-changes'
import { cn } from '@/lib/shared/cn'
import { formatRelative } from '@/lib/shared/format'
import { ASK_OPTIONS, formatAsk, MAX_ASK_NOTE, submitBlockers, type Ask, type AskType, type PitchViewData } from '@/lib/shared/pitch'
import { MAX_ANSWER_LENGTH, type Question } from '@/lib/shared/questions'
import { NETWORK_ERROR_MESSAGE, type ActionError, type Result } from '@/lib/shared/result'

type Initial = {
  pitchId: string | null
  status: 'draft' | 'changes_requested'
  answers: Record<string, string>
  ask: Ask
  savedAt: string | null
  reviewNote: string | null
  questionsChanged: boolean
}

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: number } | { kind: 'error'; message: string }

type Backup = { answers: Record<string, string>; ask: Ask; at: number }

const AUTOSAVE_MS = 1000

async function call<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn()
  } catch (e) {
    return { ok: false, error: isNetworkError(e) ? { code: 'UNAVAILABLE', message: NETWORK_ERROR_MESSAGE } : { code: 'UNKNOWN', message: 'Something went wrong. Try again in a moment.' } }
  }
}

/**
 * The pitch composer (plan §3.2): the company's questions, an optional ask, autosave (1 s debounce,
 * sessionStorage backup until saved), a live "what the company sees" preview, and a submit that is
 * disabled with explicit reasons until the pitch is ready.
 */
export function Composer({
  teamId,
  team,
  company,
  questions,
  initial,
}: {
  teamId: string
  team: PitchViewData['team']
  company: PitchViewData['company']
  questions: Question[]
  initial: Initial
}) {
  const router = useRouter()
  const backupKey = `pitfund:draft:${teamId}:${company.id}`
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers)
  const [ask, setAsk] = useState<Ask>(initial.ask)
  const [pitchId, setPitchId] = useState<string | null>(initial.pitchId)
  const [save, setSave] = useState<SaveState>(initial.savedAt ? { kind: 'saved', at: Date.parse(initial.savedAt) } : { kind: 'idle' })
  const [dirty, setDirty] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pageError, setPageError] = useState<ActionError | null>(null)
  const [, tick] = useState(0)

  const latest = useRef({ answers, ask, pitchId })
  useLayoutEffect(() => {
    latest.current = { answers, ask, pitchId }
  })
  const inFlight = useRef<Promise<string | null> | null>(null)
  const again = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistRef = useRef<(() => Promise<string | null>) | null>(null)

  // Restore an unsaved local copy (e.g. the tab closed while offline).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(backupKey)
      if (!raw) return
      const backup = JSON.parse(raw) as Backup
      const serverAt = initial.savedAt ? Date.parse(initial.savedAt) : 0
      if (backup.at > serverAt) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage after hydration
        setAnswers((a) => ({ ...a, ...backup.answers }))
        setAsk(backup.ask)
        setDirty(true)
        // The restored copy saves itself.
        timer.current = setTimeout(() => void persistRef.current?.(), AUTOSAVE_MS)
      } else {
        sessionStorage.removeItem(backupKey)
      }
    } catch {
      // Storage unavailable or corrupt: the server copy stands.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

  // "Saved · 2 min ago" stays current.
  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  useUnsavedChanges(dirty || save.kind === 'saving' || save.kind === 'error')

  const persist = useCallback(async (): Promise<string | null> => {
    if (inFlight.current) {
      again.current = true
      return inFlight.current
    }
    const run = (async () => {
      let id: string | null = null
      do {
        again.current = false
        const snapshot = latest.current
        setSave({ kind: 'saving' })
        const result = await call(() =>
          saveDraftAction({
            sponsorId: company.id,
            pitchId: snapshot.pitchId,
            answers: Object.entries(snapshot.answers).map(([questionId, answer]) => ({ questionId, answer })),
            ask: snapshot.ask,
          }),
        )
        if (!result.ok) {
          setSave({ kind: 'error', message: result.error.code === 'UNAVAILABLE' ? 'Couldn’t save.' : result.error.message })
          if (result.error.code === 'CONFLICT') setPageError(result.error)
          return null
        }
        id = result.data.pitchId
        setPitchId(id)
        latest.current = { ...latest.current, pitchId: id }
        setSave({ kind: 'saved', at: Date.now() })
        if (snapshot.answers === latest.current.answers && snapshot.ask === latest.current.ask) {
          setDirty(false)
          try {
            sessionStorage.removeItem(backupKey)
          } catch {}
        }
      } while (again.current)
      return id
    })()
    inFlight.current = run
    try {
      return await run
    } finally {
      inFlight.current = null
    }
  }, [backupKey, company.id])

  const schedule = useCallback(
    (next: { answers?: Record<string, string>; ask?: Ask }) => {
      setDirty(true)
      try {
        sessionStorage.setItem(backupKey, JSON.stringify({ answers: next.answers ?? latest.current.answers, ask: next.ask ?? latest.current.ask, at: Date.now() } satisfies Backup))
      } catch {}
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void persist(), AUTOSAVE_MS)
    },
    [backupKey, persist],
  )

  useLayoutEffect(() => {
    persistRef.current = persist
  })

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const setAnswer = (id: string, value: string) => {
    const next = { ...answers, [id]: value }
    setAnswers(next)
    latest.current = { ...latest.current, answers: next }
    if (fieldErrors[`answers.${id}`] && value.trim()) setFieldErrors(({ [`answers.${id}`]: _, ...rest }) => rest)
    schedule({ answers: next })
  }

  const updateAsk = (patch: Partial<Ask>) => {
    const next = { ...ask, ...patch }
    setAsk(next)
    latest.current = { ...latest.current, ask: next }
    schedule({ ask: next })
  }

  const blockers = useMemo(
    () => submitBlockers({ hasDeck: Boolean(team.deck), hasSummary: Boolean(team.summary?.trim()), questions, answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })), ask }),
    [answers, ask, questions, team.deck, team.summary],
  )

  const [view, setView] = useState<'write' | 'preview'>('write')

  const focusQuestion = (id: string) => {
    if (view === 'preview') {
      setView('write')
      requestAnimationFrame(() => focusQuestion(id))
      return
    }
    const el = document.getElementById(`answer-${id}`)
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    ;(el as HTMLTextAreaElement | null)?.focus({ preventScroll: true })
  }

  const [confirmOpen, setConfirmOpen] = useState(false)

  const submit = async (): Promise<Result<{ redirectTo: string }>> => {
    if (timer.current) clearTimeout(timer.current)
    const id = latest.current.pitchId ?? (await persist())
    if (!id) return { ok: false, error: { code: 'UNAVAILABLE', message: 'Couldn’t save your draft first. Check your connection and try again.' } }
    const result = await call(() =>
      submitPitchAction({
        pitchId: id,
        answers: Object.entries(latest.current.answers).map(([questionId, answer]) => ({ questionId, answer })),
        ask: latest.current.ask,
      }),
    )
    if (result.ok) {
      setDirty(false)
      try {
        sessionStorage.removeItem(backupKey)
      } catch {}
      return result
    }
    if (result.error.code === 'UNAVAILABLE' || result.error.code === 'UNKNOWN') return result
    // Anything the coach must fix goes next to the thing that failed, on the page.
    setConfirmOpen(false)
    if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors)
    if (result.error.field?.startsWith('answers.')) {
      const questionId = result.error.field.slice('answers.'.length)
      setFieldErrors((f) => ({ ...f, [result.error.field!]: result.error.message }))
      requestAnimationFrame(() => focusQuestion(questionId))
    } else {
      setPageError(result.error)
      window.scrollTo({ top: 0 })
    }
    return { ok: true, data: { redirectTo: '' } }
  }

  const preview: PitchViewData = {
    team,
    company,
    answers: questions.map((q) => ({ questionId: q.id, prompt: q.prompt, answer: answers[q.id] ?? '' })),
    ask: { type: ask.type, amountCents: ask.amountDollars ? ask.amountDollars * 100 : null, note: ask.note, label: formatAsk({ type: ask.type, amountCents: ask.amountDollars ? ask.amountDollars * 100 : null, note: ask.note }) },
    submittedAt: null,
  }

  const resubmit = initial.status === 'changes_requested'

  const editor = (
    <div className="grid min-w-0 content-start gap-8">
      <section aria-label="Questions" className="grid gap-7">
        {questions.map((q, i) => (
          <Field
            key={q.id}
            id={`answer-${q.id}`}
            label={
              <span className="user-text">
                <span className="text-text-tertiary tabular">{i + 1}. </span>
                {q.prompt}
              </span>
            }
            required={q.required}
            hint={q.help}
            aside={q.required ? null : 'Optional'}
            error={fieldErrors[`answers.${q.id}`]}
          >
            <Textarea value={answers[q.id] ?? ''} onChange={(e) => setAnswer(q.id, e.target.value)} maxLength={MAX_ANSWER_LENGTH} minRows={4} maxRows={14} />
          </Field>
        ))}
      </section>

      <section aria-labelledby="ask-heading" className="grid gap-4 border-t border-border pt-8">
        <div className="grid gap-1">
          <h2 id="ask-heading" className="text-body font-semibold text-text">
            Your ask <span className="font-normal text-text-tertiary">(optional)</span>
          </h2>
          <p className="text-small text-text-secondary">Say what you’re hoping for, or leave it open. Specific asks tend to get answers.</p>
        </div>
        <SegmentedControl<AskType> label="Your ask" options={ASK_OPTIONS} value={ask.type} onValueChange={(type) => updateAsk({ type })} />
        {ask.type === 'amount' ? (
          <Field label="Amount (USD)" hint="Whole dollars." required>
            <div className="relative max-w-56">
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-text-tertiary">
                $
              </span>
              <Input
                inputMode="numeric"
                value={ask.amountDollars ? ask.amountDollars.toLocaleString('en-US') : ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 7)
                  updateAsk({ amountDollars: digits ? Math.min(Number(digits), 1_000_000) : null })
                }}
                className="pl-7 tabular"
                placeholder="2,500"
              />
            </div>
          </Field>
        ) : null}
        {ask.type === 'in_kind' || ask.type === 'open' ? (
          <Field label={ask.type === 'in_kind' ? 'What support?' : 'Anything to add?'} required={ask.type === 'in_kind'} hint={ask.type === 'in_kind' ? 'For example: machining time, motors, software licenses.' : 'Optional.'}>
            <Textarea value={ask.note ?? ''} onChange={(e) => updateAsk({ note: e.target.value })} maxLength={MAX_ASK_NOTE} minRows={2} maxRows={6} />
          </Field>
        ) : null}
      </section>
    </div>
  )

  return (
    <div className="mt-6 grid gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid min-w-0 gap-1.5">
          <h1 className="text-h2 font-semibold tracking-tighter text-text user-text">
            {resubmit ? 'Edit and resubmit' : 'Pitch'} {company.name}
          </h1>
          <p className="text-body text-text-secondary">Answer {company.name}’s questions. A Pitfund reviewer reads every pitch before it reaches them.</p>
        </div>
        <SaveStatus state={save} dirty={dirty} onRetry={() => void persist()} />
      </header>

      <div className="grid gap-3 empty:hidden">
        {initial.reviewNote ? (
          <Banner tone="warning" title="A reviewer sent this pitch back">
            <span className="user-text-block">{initial.reviewNote}</span>
          </Banner>
        ) : null}
        {initial.questionsChanged ? (
          <Banner tone="info" title={`${company.name} updated its questions`}>
            Your answers to questions that are still here were kept. Check the new ones before you submit.
          </Banner>
        ) : null}
        {!team.deck || !team.summary?.trim() ? (
          <Banner tone="info" title="You can draft now and submit once your profile is ready" action={<Link href="/team" className="text-body font-medium text-accent hover:text-accent-hover">Open team profile</Link>}>
            Submitting needs {[!team.deck && 'your sponsorship deck', !team.summary?.trim() && 'a one-line summary'].filter(Boolean).join(' and ')}.
          </Banner>
        ) : null}
        {pageError ? (
          <Banner
            tone="danger"
            title={pageError.message}
            action={
              pageError.href ? (
                <Link href={pageError.href} className="text-body font-medium text-accent hover:text-accent-hover">
                  {pageError.href.startsWith('/pitches/') ? 'View that pitch' : 'Fix it'}
                </Link>
              ) : null
            }
          />
        ) : null}
      </div>

      {/* One editor: side by side from 1024 px; below that a Write / Preview switch shows one at a time. */}
      <SegmentedControl
        label="Show"
        value={view}
        onValueChange={setView}
        options={[
          { value: 'write', label: 'Write' },
          { value: 'preview', label: 'Preview' },
        ]}
        className="lg:hidden"
      />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn('min-w-0', view === 'preview' && 'hidden lg:block')}>{editor}</div>
        <aside aria-label="Preview" className={cn('min-w-0', view === 'write' && 'hidden lg:block')}>
          <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:rounded-dialog lg:border lg:border-border lg:bg-surface lg:p-6">
            <p className="mb-5 text-small font-medium text-text-tertiary">What {company.name} will see</p>
            <PitchView pitch={preview} headingLevel={3} />
          </div>
        </aside>
      </div>

      <footer className="grid gap-4 border-t border-border pt-6">
        {blockers.length ? (
          <div className="grid gap-2" aria-live="polite">
            <p className="text-small font-medium text-text">Before you can submit:</p>
            <ul className="grid gap-1.5">
              {blockers.map((b) => (
                <li key={`${b.key}-${b.questionId ?? ''}-${b.message}`} className="text-small text-text-secondary">
                  {b.href ? (
                    <Link href={b.href} className="font-medium text-accent hover:text-accent-hover">
                      {b.message}
                    </Link>
                  ) : b.questionId ? (
                    <button type="button" onClick={() => focusQuestion(b.questionId!)} className="font-medium text-accent hover:text-accent-hover">
                      {b.message}
                    </button>
                  ) : (
                    b.message
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {pitchId && initial.status === 'draft' ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="text-text-secondary">
                    Delete draft
                  </Button>
                }
                title="Delete this draft?"
                consequence={`Your answers to ${company.name} are deleted. You can start a new pitch to them later this season.`}
                confirmLabel="Delete draft"
                pendingLabel="Deleting…"
                tone="danger"
                onConfirm={() => {
                  if (timer.current) clearTimeout(timer.current)
                  return deleteDraftAction({ pitchId })
                }}
                onConfirmed={(data) => {
                  setDirty(false)
                  try {
                    sessionStorage.removeItem(backupKey)
                  } catch {}
                  router.push(data.redirectTo)
                  router.refresh()
                }}
              />
            ) : null}
          </div>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            trigger={
              <Button size="lg" disabled={blockers.length > 0}>
                {resubmit ? 'Resubmit for review' : 'Submit for review'}
              </Button>
            }
            title={`Send this pitch to ${company.name} for review?`}
            consequence={`A Pitfund reviewer reads every pitch before it reaches ${company.name}, usually within a day. You can’t edit it while it’s in review.`}
            confirmLabel={resubmit ? 'Resubmit' : 'Submit'}
            pendingLabel="Submitting…"
            onConfirm={submit}
            onConfirmed={(data) => {
              if (data.redirectTo) {
                router.push(data.redirectTo)
                router.refresh()
              }
            }}
          />
        </div>
      </footer>
    </div>
  )
}

function SaveStatus({ state, dirty, onRetry }: { state: SaveState; dirty: boolean; onRetry: () => void }) {
  return (
    <p className="flex min-h-8 shrink-0 items-center gap-2 text-small" aria-live="polite">
      {state.kind === 'saving' ? (
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <Spinner size={12} /> Saving…
        </span>
      ) : state.kind === 'error' ? (
        <>
          <span className="text-danger">{state.message}</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            Retry
          </Button>
        </>
      ) : dirty ? (
        <span className="text-text-tertiary">Unsaved changes</span>
      ) : state.kind === 'saved' ? (
        <span className="inline-flex items-center gap-1.5 text-text-tertiary">
          <Check aria-hidden="true" className="size-3.5 text-success" /> Saved · {formatRelative(new Date(state.at))}
        </span>
      ) : (
        <span className="text-text-tertiary">Drafts save automatically</span>
      )}
    </p>
  )
}
