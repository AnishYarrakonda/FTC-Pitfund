'use client'

import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/* A native checkbox, styled, with its label, optional description and error. */

type CheckboxProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  error?: string | null
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  className?: string
}

export function Checkbox({ label, description, error, className, id, onCheckedChange, ...props }: CheckboxProps) {
  const generated = useId()
  const controlId = id ?? `checkbox-${generated}`
  const descriptionId = description ? `${controlId}-description` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 grid size-4 shrink-0 place-items-center">
          <input
            {...props}
            type="checkbox"
            id={controlId}
            aria-invalid={error ? true : undefined}
            aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            className={cn(
              'peer size-4 cursor-pointer appearance-none rounded-[4px] border border-border-strong bg-surface',
              'transition-colors duration-120 hover:border-text-tertiary',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              'checked:border-accent checked:bg-accent',
              'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger',
            )}
          />
          <svg aria-hidden="true" viewBox="0 0 12 12" className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100" fill="none">
            <path d="M2.5 6.2 5 8.5l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="grid min-w-0 gap-0.5">
          <label htmlFor={controlId} className="text-body text-text">
            {label}
          </label>
          {description ? (
            <p id={descriptionId} className="text-small text-text-tertiary">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="pl-7 text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
