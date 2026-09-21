'use client'

import { Check, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'

import { createUploadUrl, saveProof } from '@/app/actions/team'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/client/toast'
import { NETWORK_ERROR_MESSAGE } from '@/lib/shared/result'

type Stage = { kind: 'idle' } | { kind: 'working'; label: string } | { kind: 'error'; message: string; retry: File | null }

const loadModules = () => Promise.all([import('@/lib/client/image'), import('@/lib/client/upload')])

/**
 * The screenshot that shows this person is on their team's roster.
 *
 * It goes to a private bucket and is only ever read by an admin through a short-lived signed URL —
 * it is a picture of someone's dashboard with names on it, not something to put on the internet. So
 * there is no preview here: once it's uploaded we say so and move on.
 */
export function ProofUpload({ uploaded }: { uploaded: boolean }) {
  const router = useRouter()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [done, setDone] = useState(uploaded)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const busy = stage.kind === 'working'

  const start = async (file: File) => {
    let modules: Awaited<ReturnType<typeof loadModules>> | null = null
    try {
      setStage({ kind: 'working', label: 'Preparing…' })
      modules = await loadModules()
      const [{ loadLogoSource }, { putFile }] = modules
      // Screenshots are wide, so this isn't squared or re-encoded — it goes up as chosen. Decoding it
      // first is just the file check (type, size, actually an image) before anything is uploaded.
      ;(await loadLogoSource(file)).close()
      setStage({ kind: 'working', label: 'Uploading…' })
      const imageType = file.type === 'image/jpeg' ? 'image/jpeg' : file.type === 'image/png' ? 'image/png' : 'image/webp'
      const target = await createUploadUrl({ purpose: 'proof', imageType })
      if (!target.ok) return setStage({ kind: 'error', message: target.error.message, retry: target.error.code === 'UNAVAILABLE' ? file : null })
      await putFile(target.data.signedUrl, file, { contentType: file.type })
      setStage({ kind: 'working', label: 'Saving…' })
      const saved = await saveProof({ path: target.data.path })
      if (!saved.ok) return setStage({ kind: 'error', message: saved.error.message, retry: saved.error.code === 'UNAVAILABLE' ? file : null })
      setDone(true)
      setStage({ kind: 'idle' })
      toast.success('Screenshot uploaded.')
      router.refresh()
    } catch (e) {
      if (modules && e instanceof modules[0].ImageCheckError) return setStage({ kind: 'error', message: e.message, retry: null })
      setStage({ kind: 'error', message: NETWORK_ERROR_MESSAGE, retry: file })
    }
  }

  return (
    <div className="grid gap-3 rounded-menu border border-border bg-surface p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-control bg-muted text-text-tertiary">
          {busy ? <Spinner size={16} className="text-accent" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
        </span>
        <div className="grid min-w-0 gap-1">
          <p className="text-body font-medium text-text">Proof that you coach this team</p>
          <p className="text-small text-text-secondary">
            A screenshot of your team&apos;s page in the FIRST Dashboard. It can come from any coach or mentor&apos;s account, so your coach can send it to you.
            Only an FTC Pitfund admin sees it, and we delete it once you&apos;re approved.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-11">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()} aria-describedby={`${inputId}-status`}>
          {done ? 'Replace screenshot' : 'Upload screenshot'}
        </Button>
        {stage.kind === 'error' && stage.retry ? (
          <Button variant="ghost" size="sm" onClick={() => stage.retry && void start(stage.retry)}>
            Retry
          </Button>
        ) : null}
      </div>
      <p id={`${inputId}-status`} aria-live="polite" className="min-w-0 pl-11 text-small">
        {stage.kind === 'working' ? (
          <span className="text-text-secondary">{stage.label}</span>
        ) : stage.kind === 'error' ? (
          <span role="alert" className="text-danger">
            {stage.message}
          </span>
        ) : done ? (
          <span className="inline-flex items-center gap-1 text-success">
            <Check aria-hidden="true" className="size-3.5" /> Screenshot uploaded
          </span>
        ) : (
          <span className="text-text-tertiary">PNG, JPEG or WebP up to 2 MB.</span>
        )}
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Proof screenshot"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void start(file)
        }}
      />
    </div>
  )
}
