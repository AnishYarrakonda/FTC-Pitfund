'use client'

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

type FieldContextValue = { id: string; describedBy: string | undefined; invalid: boolean; required: boolean }

const FieldContext = createContext<FieldContextValue | null>(null)

/** Controls inside a Field pick up id, aria-describedby, aria-invalid and required from it. */
export function useFieldControl(props: Pick<ComponentProps<'input'>, 'id' | 'aria-describedby' | 'aria-invalid' | 'required'>) {
  const field = useContext(FieldContext)
  return {
    id: props.id ?? field?.id,
    'aria-describedby': [props['aria-describedby'], field?.describedBy].filter(Boolean).join(' ') || undefined,
    'aria-invalid': props['aria-invalid'] ?? (field?.invalid || undefined),
    required: props.required ?? (field?.required || undefined),
  }
}

export type FieldProps = {
  label: ReactNode
  children: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  /** Shown to the right of the label, e.g. "Optional" or a counter. */
  aside?: ReactNode
  className?: string
  id?: string
  hideLabel?: boolean
}

/** Label, control, hint and error, wired for assistive tech. */
export function Field({ label, children, hint, error, required = false, aside, className, id, hideLabel }: FieldProps) {
  const generated = useId()
  const controlId = id ?? `field-${generated}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error), required }}>
      <div className={cn('flex min-w-0 flex-col gap-1.5', className)} data-invalid={error ? '' : undefined}>
        <div className={cn('flex items-baseline justify-between gap-3', hideLabel && 'sr-only')}>
          <label htmlFor={controlId} className="text-small font-medium text-text">
            {label}
            {required ? (
              <span className="text-text-tertiary" aria-hidden="true">
                {' '}
                *
              </span>
            ) : null}
          </label>
          {aside ? <div className="text-caption text-text-tertiary">{aside}</div> : null}
        </div>
        {children}
        {hint && !error ? (
          <p id={hintId} className="text-small text-text-tertiary">
            {hint}
          </p>
        ) : null}
        {hint && error ? (
          <p id={hintId} className="sr-only">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="text-small text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

/** A titled group of fields, separated from the next section by spacing and a rule. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid gap-5 border-t border-border py-8 first:border-t-0 first:pt-0', className)}>
      <div className="grid gap-1">
        <h2 className="text-lead font-semibold tracking-tight text-text">{title}</h2>
        {description ? <p className="text-body text-text-secondary">{description}</p> : null}
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  )
}
