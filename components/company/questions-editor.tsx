'use client'

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { keepDefaultQuestions, saveQuestions } from '@/app/actions/company'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/choice'
import { ConfirmDialog, Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Field, FormSection } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import { useUnsavedChanges } from '@/lib/client/use-unsaved-changes'
import { newQuestion } from '@/lib/shared/company'
import { DEFAULT_QUESTIONS, MAX_QUESTION_HELP, MAX_QUESTION_PROMPT, MAX_QUESTIONS, questionsFor, type Question } from '@/lib/shared/questions'

const APPLY_NOTE = 'Changes apply to new pitches; pitches already submitted keep the questions they answered.'

type EditorQuestion = Question & { help: string }

const toEditor = (qs: Question[]): EditorQuestion[] => qs.map((q) => ({ ...q, help: q.help ?? '' }))
const clean = (qs: EditorQuestion[]) => qs.map((q) => ({ id: q.id, prompt: q.prompt.trim(), help: q.help.trim() || undefined, required: q.required }))
const same = (a: EditorQuestion[], b: EditorQuestion[]) => JSON.stringify(clean(a)) === JSON.stringify(clean(b))

/**
 * The questions every pitch to this company answers (plan §1 rule 6): the three defaults, or 0–10
 * of the company's own. Reordering uses buttons (keyboard and screen-reader friendly), not drag.
 */
export function QuestionsEditor({
  companyName,
  customQuestions,
  reviewed,
  onPreviewChange,
}: {
  companyName: string
  customQuestions: Question[]
  reviewed: boolean
  onPreviewChange: (questions: Question[], usesDefaults: boolean) => void
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<EditorQuestion[]>(() => toEditor(customQuestions))
  const [draft, setDraft] = useState<EditorQuestion[]>(() => toEditor(customQuestions))
  const [editing, setEditing] = useState(customQuestions.length > 0)
  const [notice, setNotice] = useState<string | null>(null)
  const dirty = editing && !same(draft, saved)
  const usesDefaults = !editing

  const { run, pending, error, fieldErrors, reset } = useAction(saveQuestions, {
    errorToast: false,
    onSuccess: (profile) => {
      const next = toEditor(profile.customQuestions)
      setSaved(next)
      setDraft(next)
      setEditing(next.length > 0)
      setNotice(next.length > 0 ? `Questions saved. ${APPLY_NOTE}` : `Teams will answer the default questions. ${APPLY_NOTE}`)
      router.refresh()
    },
  })

  useUnsavedChanges(dirty)

  useEffect(() => {
    const shown = usesDefaults ? questionsFor({ name: companyName || 'your company', questions: [] }) : clean(draft).filter((q) => q.prompt)
    onPreviewChange(shown, usesDefaults)
  }, [companyName, draft, onPreviewChange, usesDefaults])

  const update = (index: number, patch: Partial<EditorQuestion>) => {
    setNotice(null)
    setDraft((d) => d.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }
  const move = (index: number, delta: -1 | 1) => {
    setNotice(null)
    setDraft((d) => {
      const next = [...d]
      const [item] = next.splice(index, 1)
      next.splice(index + delta, 0, item)
      return next
    })
    // Keep focus on the moved question's button so repeated presses keep moving it.
    requestAnimationFrame(() => document.getElementById(`move-${delta < 0 ? 'up' : 'down'}-${index + delta}`)?.focus())
  }
  const remove = (index: number) => {
    setNotice(null)
    setDraft((d) => d.filter((_, i) => i !== index))
  }
  const add = () => {
    setNotice(null)
    const q = { ...newQuestion(), help: '' }
    setDraft((d) => [...d, q])
    requestAnimationFrame(() => document.getElementById(`prompt-${q.id}`)?.focus())
  }
  const customize = () => {
    setNotice(null)
    setEditing(true)
    if (draft.length === 0) {
      const name = companyName || 'your company'
      setDraft(DEFAULT_QUESTIONS.map((q) => ({ ...newQuestion(), prompt: q.prompt.replaceAll('{Company}', name), required: q.required, help: '' })))
    }
  }

  const errorFor = (index: number, key: 'prompt' | 'help') => fieldErrors[`questions.${index}.${key}`]

  return (
    <FormSection id="questions" title="Questions for teams" description="Every pitch to your company answers these, alongside the team’s deck.">
      {notice ? (
        <p role="status" className="flex items-start gap-2 text-body text-success">
          <Check aria-hidden="true" className="mt-[3px] size-4 shrink-0" />
          <span className="min-w-0">{notice}</span>
        </p>
      ) : null}

      {!editing ? (
        <div className="grid gap-5">
          <div className="grid gap-4 rounded-menu border border-border bg-surface p-5">
            <p className="text-body font-medium text-text">Teams answer our default questions</p>
            <ol className="grid gap-3">
              {questionsFor({ name: companyName || 'your company', questions: [] }).map((q, i) => (
                <li key={q.id} className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] gap-x-2">
                  <span className="text-body text-text-tertiary tabular">{i + 1}.</span>
                  <p className="min-w-0 text-body text-text-secondary user-text">
                    {q.prompt}
                    <span className="ml-2 text-small text-text-tertiary">{q.required ? 'Required' : 'Optional'}</span>
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={customize}>
              Customize
            </Button>
            {!reviewed ? (
              <ActionButton variant="ghost" action={() => keepDefaultQuestions({})} pendingLabel="Saving…" successLabel="Saved" onSuccess={() => router.refresh()}>
                Use these questions
              </ActionButton>
            ) : null}
            <p className="text-small text-text-tertiary">Write up to {MAX_QUESTIONS} of your own instead.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          {draft.length === 0 ? (
            <p className="rounded-menu border border-dashed border-border-strong px-5 py-8 text-center text-body text-text-secondary">
              No questions. Add one, or save to use the default questions.
            </p>
          ) : (
            <ol className="grid gap-4" aria-label="Your questions">
              {draft.map((q, index) => (
                <li key={q.id} className="grid min-w-0 gap-4 rounded-menu border border-border bg-surface p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-small font-medium text-text-tertiary tabular">Question {index + 1}</p>
                    <div className="flex items-center gap-0.5">
                      <IconButton id={`move-up-${index}`} size="sm" label={`Move question ${index + 1} up`} icon={<ArrowUp aria-hidden="true" />} disabled={index === 0} onClick={() => move(index, -1)} />
                      <IconButton id={`move-down-${index}`} size="sm" label={`Move question ${index + 1} down`} icon={<ArrowDown aria-hidden="true" />} disabled={index === draft.length - 1} onClick={() => move(index, 1)} />
                      <DeleteQuestion index={index} prompt={q.prompt} onDelete={() => remove(index)} />
                    </div>
                  </div>
                  <Field label="Question" required error={errorFor(index, 'prompt')} id={`prompt-${q.id}`}>
                    <Textarea value={q.prompt} onChange={(e) => update(index, { prompt: e.target.value.replace(/\n/g, ' ') })} maxLength={MAX_QUESTION_PROMPT} minRows={1} maxRows={5} />
                  </Field>
                  <Field label="Helper text" hint="Optional. A hint shown under the question." error={errorFor(index, 'help')}>
                    <Input value={q.help} onChange={(e) => update(index, { help: e.target.value })} maxLength={MAX_QUESTION_HELP} />
                  </Field>
                  <Checkbox checked={q.required} onCheckedChange={(on) => update(index, { required: on })} label="Required" description="Teams can’t submit without answering it." />
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={add} disabled={draft.length >= MAX_QUESTIONS} aria-describedby="add-question-hint">
              <Plus aria-hidden="true" />
              Add question
            </Button>
            <p id="add-question-hint" className="text-small text-text-tertiary tabular">
              {draft.length >= MAX_QUESTIONS ? `You can ask up to ${MAX_QUESTIONS} questions.` : `${draft.length} of ${MAX_QUESTIONS}`}
            </p>
          </div>

          {error && !Object.keys(fieldErrors).some((k) => k.startsWith('questions.')) ? (
            <p role="alert" className="text-body text-danger">
              {error.message}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            {saved.length > 0 ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" className="justify-self-start text-text-secondary" disabled={pending}>
                    Reset to defaults
                  </Button>
                }
                title="Reset to the default questions?"
                consequence={`Your ${saved.length === 1 ? 'question is' : `${saved.length} questions are`} removed and new pitches answer the three default questions. Pitches already submitted keep theirs.`}
                confirmLabel="Reset to defaults"
                pendingLabel="Resetting…"
                tone="danger"
                onConfirm={() => saveQuestions({ questions: [] })}
                onConfirmed={() => {
                  setSaved([])
                  setDraft([])
                  setEditing(false)
                  setNotice(`Teams will answer the default questions. ${APPLY_NOTE}`)
                  router.refresh()
                }}
              />
            ) : (
              <Button
                variant="ghost"
                className="justify-self-start text-text-secondary"
                disabled={pending}
                onClick={() => {
                  reset()
                  setDraft([])
                  setEditing(false)
                }}
              >
                Keep the defaults
              </Button>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="text-small text-text-tertiary" aria-live="polite">
                {dirty ? 'Unsaved changes' : null}
              </p>
              <Button data-action-button="" loading={pending} loadingLabel="Saving…" disabled={!dirty && !pending} onClick={() => void run({ questions: clean(draft) })}>
                Save questions
              </Button>
            </div>
          </div>
          <p className="text-small text-text-tertiary">{APPLY_NOTE}</p>
        </div>
      )}
    </FormSection>
  )
}

function DeleteQuestion({ index, prompt, onDelete }: { index: number; prompt: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <IconButton size="sm" label={`Delete question ${index + 1}`} icon={<Trash2 aria-hidden="true" />} />
      </DialogTrigger>
      <DialogContent
        size="sm"
        title={`Delete question ${index + 1}?`}
        description={prompt.trim() ? `“${prompt.trim().slice(0, 120)}${prompt.trim().length > 120 ? '…' : ''}” is removed when you save.` : 'This empty question is removed.'}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false)
                onDelete()
              }}
            >
              Delete question
            </Button>
          </>
        }
      />
    </Dialog>
  )
}
