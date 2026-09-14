'use client'

import { Check, ImageUp, RotateCcw } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { OrgLogo } from '@/components/ui/identity'
import { Spinner } from '@/components/ui/spinner'
import { ImageCheckError, squareLogo } from '@/lib/client/image'
import { putFile, UploadError } from '@/lib/client/upload'
import { NETWORK_ERROR_MESSAGE, type Result } from '@/lib/shared/result'

type Stage = { kind: 'idle' } | { kind: 'working'; label: string } | { kind: 'done' } | { kind: 'error'; message: string; retry: File | null }

/**
 * Logo picker: crop to a centered square and resize to 512 px in the browser, upload straight to
 * storage, then let the server verify and publish it. Shared by teams (/team) and companies
 * (/company, prompt 3): the caller passes the two actions.
 */
export function LogoUpload({
  name,
  currentUrl,
  createUpload,
  finalize,
  onSaved,
}: {
  name: string
  currentUrl: string | null
  createUpload: (imageType: 'image/webp' | 'image/jpeg') => Promise<Result<{ signedUrl: string; path: string }>>
  finalize: (path: string) => Promise<Result<{ logoUrl: string | null }>>
  onSaved?: (logoUrl: string | null) => void
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const busy = stage.kind === 'working'

  useEffect(() => {
    if (stage.kind !== 'done') return
    const timer = setTimeout(() => setStage({ kind: 'idle' }), 3000)
    return () => clearTimeout(timer)
  }, [stage.kind])

  const start = async (file: File) => {
    try {
      setStage({ kind: 'working', label: 'Resizing…' })
      const blob = await squareLogo(file)
      setStage({ kind: 'working', label: 'Uploading…' })
      const target = await createUpload(blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp')
      if (!target.ok) return setStage({ kind: 'error', message: target.error.message, retry: target.error.code === 'UNAVAILABLE' ? file : null })
      await putFile(target.data.signedUrl, blob, { contentType: blob.type })
      setStage({ kind: 'working', label: 'Saving…' })
      const saved = await finalize(target.data.path)
      if (!saved.ok) return setStage({ kind: 'error', message: saved.error.message, retry: saved.error.code === 'UNAVAILABLE' ? file : null })
      setPreview(saved.data.logoUrl)
      setStage({ kind: 'done' })
      onSaved?.(saved.data.logoUrl)
    } catch (e) {
      if (e instanceof ImageCheckError) return setStage({ kind: 'error', message: e.message, retry: null })
      if (e instanceof UploadError && e.kind === 'network') return setStage({ kind: 'error', message: 'Upload interrupted.', retry: file })
      setStage({ kind: 'error', message: NETWORK_ERROR_MESSAGE, retry: file })
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-4">
      <div className="relative">
        <OrgLogo name={name} src={preview} size="lg" />
        {busy ? (
          <span className="absolute inset-0 grid place-items-center rounded-dialog bg-surface/70">
            <Spinner className="text-accent" />
          </span>
        ) : null}
      </div>
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()} aria-describedby={`${inputId}-status`}>
            <ImageUp aria-hidden="true" />
            {preview ? 'Replace logo' : 'Upload logo'}
          </Button>
          {stage.kind === 'error' && stage.retry ? (
            <Button variant="ghost" size="sm" onClick={() => stage.retry && void start(stage.retry)}>
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          ) : null}
        </div>
        <p id={`${inputId}-status`} aria-live="polite" className="min-w-0 text-small">
          {stage.kind === 'working' ? (
            <span className="text-text-secondary">{stage.label}</span>
          ) : stage.kind === 'done' ? (
            <span className="inline-flex items-center gap-1 text-success">
              <Check aria-hidden="true" className="size-3.5" /> Logo updated
            </span>
          ) : stage.kind === 'error' ? (
            <span role="alert" className="text-danger">
              {stage.message}
            </span>
          ) : (
            <span className="text-text-tertiary">PNG, JPEG or WebP up to 2 MB. We crop it to a square.</span>
          )}
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Logo image"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void start(file)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
