'use client'

import { FileUp, RotateCcw, X } from 'lucide-react'
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'
import { formatBytes } from '@/lib/shared/format'

import { Button } from './button'
import { Spinner } from './spinner'

export type FileDropProgress = { loaded: number; total: number }

type FileDropProps = {
  /** e.g. "Upload your sponsorship deck" */
  title: ReactNode
  /** e.g. "PDF, up to 5 pages and 10 MB" */
  description: ReactNode
  accept: string
  onFile: (file: File) => void
  /** Upload progress: renders a real progress bar with a Cancel button. */
  progress?: FileDropProgress | null
  onCancel?: () => void
  /** A labelled stage without byte progress, e.g. "Checking your PDF…" */
  stage?: ReactNode
  error?: ReactNode
  onRetry?: () => void
  disabled?: boolean
  className?: string
}

/**
 * Drop zone + file picker with upload progress, stages and errors (plan §3.2 "PDF upload").
 * The whole zone is a <label> for a real file input, so it works by keyboard and screen reader.
 */
export function FileDrop({
  title,
  description,
  accept,
  onFile,
  progress,
  onCancel,
  stage,
  error,
  onRetry,
  disabled,
  className,
}: FileDropProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const busy = Boolean(progress || stage)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled || busy) return
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  if (progress || stage) {
    const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null
    return (
      <div className={cn('rounded-menu border border-border bg-surface p-5', className)} aria-busy="true">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Spinner className="text-accent" />
            <p className="min-w-0 text-body text-text" aria-live="polite">
              {progress ? (
                <>
                  Uploading{' '}
                  <span className="tabular">
                    {formatBytes(progress.loaded)} of {formatBytes(progress.total)}
                  </span>
                </>
              ) : (
                stage
              )}
            </p>
          </div>
          {progress && onCancel ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
        <div
          className="mt-4 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
        >
          {percent !== null ? (
            <div className="h-full rounded-full bg-accent transition-[width] duration-120" style={{ width: `${percent}%` }} />
          ) : (
            <div className="h-full w-2/5 animate-progress rounded-full bg-accent motion-reduce:animate-pulse" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-menu border border-dashed px-6 py-8 text-center',
          'transition-[border-color,background-color] duration-120',
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
          dragging ? 'border-accent bg-accent-subtle' : 'border-border-strong bg-surface hover:border-text-tertiary',
          error && !dragging && 'border-danger',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="grid size-9 place-items-center rounded-menu border border-border bg-canvas text-text-secondary">
          <FileUp aria-hidden="true" className="size-4" />
        </span>
        <span className="grid gap-1">
          <span className="text-body font-medium text-text">{title}</span>
          <span className="text-small text-text-tertiary">{description}</span>
        </span>
        <span className="text-small font-medium text-accent group-hover:text-accent-hover">
          {dragging ? 'Drop to upload' : 'Choose a file or drag it here'}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            e.target.value = ''
          }}
        />
      </label>
      {error ? (
        <div className="flex items-start justify-between gap-3" role="alert">
          <p className="flex min-w-0 items-start gap-1.5 text-small text-danger">
            <X aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RotateCcw aria-hidden="true" />
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
