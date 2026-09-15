'use client'

import { ArrowUpRight, CheckCircle2, FileText } from 'lucide-react'
import { useRef, useState } from 'react'

import { Checkbox } from '@/components/ui/checkbox'
import { FileDrop } from '@/components/ui/file-drop'
import { TimeText } from '@/components/ui/time-text'
import { formatBytes } from '@/lib/shared/format'
import { NETWORK_ERROR_MESSAGE, type Result } from '@/lib/shared/result'
import { DECK_MESSAGES } from '@/lib/shared/team'

// The pre-check (pdf.js wrapper, thumbnail encoder) and the uploader load when a file is chosen.
const loadPdf = () => import('@/lib/client/pdf')
const loadUpload = () => import('@/lib/client/upload')

export type DeckInfo = { url: string; pages: number; bytes: number; thumbUrl: string | null; updatedAt: Date | string } | null

type Target = { signedUrl: string; path: string }

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'uploading'; loaded: number; total: number }
  | { kind: 'checking' }
  | { kind: 'saving' }
  | { kind: 'done' }
  | { kind: 'error'; message: string; retry: boolean }

type Prepared = { file: File; thumbnail: Blob; pages: number }

/**
 * The deck upload (plan §3.2 "PDF upload"):
 *   I  drop zone + permission checkbox
 *   A  browser pre-check with pdf.js (type, size, pages) and a page-1 thumbnail, before any network
 *   P1 "Uploading 2.1 of 4.3 MB" with a Cancel that aborts the request
 *   P2 "Checking your PDF…" (server re-verifies the bytes)
 *   P3 "Creating preview…" (the thumbnail is saved and the team updated)
 *   S  new thumbnail + "Deck updated · visible on your public page"
 *   E  "Upload interrupted." with Retry (keeps the file) or the exact rejection
 */
export function DeckUpload({
  deck,
  actions,
  onSaved,
}: {
  deck: DeckInfo
  actions: {
    createUpload: (purpose: 'deck' | 'thumb', imageType?: 'image/webp' | 'image/jpeg') => Promise<Result<Target>>
    check: (path: string) => Promise<Result<{ receipt: string; pages: number; bytes: number }>>
    save: (input: { receipt: string; thumbPath: string; consent: boolean }) => Promise<Result<{ deck: DeckInfo }>>
  }
  onSaved?: (deck: DeckInfo) => void
}) {
  const [current, setCurrent] = useState<DeckInfo>(deck)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  // The checked file stays here until it's saved, so Retry and a late consent don't re-read it.
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [waitingForConsent, setWaitingForConsent] = useState(false)
  const abort = useRef<AbortController | null>(null)

  const fail = (message: string, retry: boolean) => setStage({ kind: 'error', message, retry })

  const upload = async (item: Prepared) => {
    const controller = new AbortController()
    abort.current = controller
    let UploadError: Awaited<ReturnType<typeof loadUpload>>['UploadError'] | null = null
    try {
      const uploader = await loadUpload()
      UploadError = uploader.UploadError
      const { putFile } = uploader
      const total = item.file.size + item.thumbnail.size
      setStage({ kind: 'uploading', loaded: 0, total })
      const [pdfTarget, thumbTarget] = await Promise.all([
        actions.createUpload('deck'),
        actions.createUpload('thumb', item.thumbnail.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'),
      ])
      if (!pdfTarget.ok) return fail(pdfTarget.error.message, pdfTarget.error.code === 'UNAVAILABLE')
      if (!thumbTarget.ok) return fail(thumbTarget.error.message, thumbTarget.error.code === 'UNAVAILABLE')
      if (controller.signal.aborted) return

      await putFile(pdfTarget.data.signedUrl, item.file, {
        contentType: 'application/pdf',
        signal: controller.signal,
        onProgress: (p) => setStage({ kind: 'uploading', loaded: p.loaded, total }),
      })
      await putFile(thumbTarget.data.signedUrl, item.thumbnail, {
        contentType: item.thumbnail.type,
        signal: controller.signal,
        onProgress: (p) => setStage({ kind: 'uploading', loaded: item.file.size + p.loaded, total }),
      })

      setStage({ kind: 'checking' })
      const checked = await actions.check(pdfTarget.data.path)
      if (!checked.ok) return fail(checked.error.message, checked.error.code === 'UNAVAILABLE')

      setStage({ kind: 'saving' })
      const saved = await actions.save({ receipt: checked.data.receipt, thumbPath: thumbTarget.data.path, consent: true })
      if (!saved.ok) return fail(saved.error.message, saved.error.code === 'UNAVAILABLE' || saved.error.code === 'NOT_FOUND')

      setPrepared(null)
      setCurrent(saved.data.deck)
      setStage({ kind: 'done' })
      onSaved?.(saved.data.deck)
    } catch (e) {
      if (UploadError && e instanceof UploadError && e.kind === 'aborted') return
      if (UploadError && e instanceof UploadError && e.kind === 'rejected') return fail('The upload was refused. Try a different file.', false)
      if (UploadError && e instanceof UploadError) return fail(DECK_MESSAGES.interrupted, true)
      fail(NETWORK_ERROR_MESSAGE, true)
    } finally {
      if (abort.current === controller) abort.current = null
    }
  }

  const choose = async (file: File, consented = consent) => {
    setPrepared(null)
    setStage({ kind: 'reading' })
    let result: { pages: number; thumbnail: Blob }
    let pdf: Awaited<ReturnType<typeof loadPdf>>
    try {
      pdf = await loadPdf()
    } catch {
      return fail(NETWORK_ERROR_MESSAGE, false)
    }
    try {
      result = await pdf.inspectDeck(file)
    } catch (e) {
      return fail(e instanceof pdf.DeckCheckError ? e.message : DECK_MESSAGES.notPdf, false)
    }
    const item = { file, ...result }
    setPrepared(item)
    if (!consented) {
      setWaitingForConsent(true)
      setConsentError(true)
      setStage({ kind: 'idle' })
      return
    }
    await upload(item)
  }

  const cancel = () => {
    abort.current?.abort()
    abort.current = null
    setPrepared(null)
    setStage({ kind: 'idle' })
  }

  const stageLabel =
    stage.kind === 'reading'
      ? 'Reading your PDF…'
      : stage.kind === 'checking'
        ? 'Checking your PDF…'
        : stage.kind === 'saving'
          ? 'Creating preview…'
          : null

  return (
    <div className="grid min-w-0 gap-5">
      {current ? (
        <div className="flex min-w-0 items-center gap-4">
          <a
            href={current.url}
            target="_blank"
            rel="noreferrer"
            className="relative block aspect-[612/792] w-20 shrink-0 overflow-hidden rounded-menu border border-border bg-canvas transition-colors duration-120 hover:border-border-strong"
            aria-label="Open your current deck"
          >
            {current.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- storage-hosted page-1 thumbnail
              <img src={current.thumbUrl} alt="" className="size-full object-cover object-top" />
            ) : (
              <FileText aria-hidden="true" className="absolute inset-0 m-auto size-5 text-text-tertiary" />
            )}
          </a>
          <div className="grid min-w-0 gap-1">
            {stage.kind === 'done' ? (
              <p className="inline-flex items-center gap-1.5 text-body font-medium text-success" role="status">
                <CheckCircle2 aria-hidden="true" className="size-4" /> Deck updated · visible on your public page
              </p>
            ) : (
              <p className="text-body font-medium text-text">Current deck</p>
            )}
            <p className="text-small text-text-tertiary tabular">
              {current.pages} {current.pages === 1 ? 'page' : 'pages'} · {formatBytes(current.bytes)} · Updated <TimeText date={current.updatedAt} format="date" />
            </p>
            <a href={current.url} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-small font-medium text-accent hover:text-accent-hover">
              Open PDF
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>
      ) : null}

      <Checkbox
        checked={consent}
        onCheckedChange={(checked) => {
          setConsent(checked)
          if (checked) setConsentError(false)
          if (checked && prepared && waitingForConsent) {
            setWaitingForConsent(false)
            void upload(prepared)
          }
        }}
        label="I have permission to share any photos of people in this document."
        error={consentError ? `${DECK_MESSAGES.consent}${prepared ? ` Your file ${prepared.file.name} is ready to upload.` : ''}` : null}
      />

      <FileDrop
        title={current ? 'Replace your sponsorship deck' : 'Upload your sponsorship deck'}
        description="PDF, up to 5 pages and 10 MB"
        accept="application/pdf,.pdf"
        onFile={(file) => void choose(file)}
        progress={stage.kind === 'uploading' ? { loaded: stage.loaded, total: stage.total } : null}
        onCancel={cancel}
        stage={stageLabel}
        error={stage.kind === 'error' ? stage.message : null}
        onRetry={stage.kind === 'error' && stage.retry && prepared ? () => void upload(prepared) : undefined}
      />
    </div>
  )
}
