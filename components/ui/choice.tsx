'use client'

import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/*
 * RadioCards and SegmentedControl (Checkbox is ./checkbox.tsx): the choice controls. Native inputs
 * (styled), so the browser provides keyboard behavior (Space, arrow keys within a radio group),
 * form semantics and accessible names, with no component library on the page.
 */

type ChoiceOption<V extends string> = { value: V; label: ReactNode; description?: ReactNode; disabled?: boolean }

type RadioCardsProps<V extends string> = {
  options: ChoiceOption<V>[]
  /** Controlled: undefined (or a value no option has) means nothing is chosen. */
  value?: V
  defaultValue?: V
  onValueChange?: (value: V) => void
  name?: string
  label: string
  className?: string
  columns?: 1 | 2
}

/** Large radio options with a title and description (e.g. the welcome role choice). */
export function RadioCards<V extends string>({ options, onValueChange, label, className, columns = 2, value, defaultValue, name }: RadioCardsProps<V>) {
  const generated = useId()
  const group = name ?? `radio-${generated}`
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2', className)}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'group relative grid min-w-0 cursor-pointer gap-1 rounded-menu border border-border-strong bg-surface p-4 pr-10 text-left',
            'transition-[border-color,box-shadow,background-color] duration-120 hover:border-text-tertiary',
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
            'has-checked:border-accent has-checked:bg-accent-subtle/40 has-checked:shadow-[inset_0_0_0_1px_var(--color-accent)]',
            'has-disabled:cursor-not-allowed has-disabled:opacity-60',
          )}
        >
          <input
            type="radio"
            name={group}
            value={option.value}
            disabled={option.disabled}
            checked={(value ?? defaultValue) === option.value}
            onChange={() => onValueChange?.(option.value)}
            className="absolute inset-0 size-full cursor-pointer appearance-none rounded-menu opacity-0 disabled:cursor-not-allowed"
          />
          <span className="text-body font-medium text-text">{option.label}</span>
          {option.description ? <span className="text-small text-text-secondary">{option.description}</span> : null}
          <span
            aria-hidden="true"
            className="absolute top-4 right-4 grid size-4 place-items-center rounded-full border border-border-strong bg-surface group-has-checked:border-accent"
          >
            <span className="hidden size-2 rounded-full bg-accent group-has-checked:block" />
          </span>
        </label>
      ))}
    </div>
  )
}

type SegmentedProps<V extends string> = {
  options: ChoiceOption<V>[]
  value: V
  onValueChange: (value: V) => void
  label: string
  name?: string
  className?: string
  size?: 'sm' | 'md'
}

/** A compact single choice, e.g. No ask · Amount · In-kind · Open to discuss. */
export function SegmentedControl<V extends string>({ options, onValueChange, label, className, size = 'md', value, name }: SegmentedProps<V>) {
  const generated = useId()
  const group = name ?? `segmented-${generated}`
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex w-fit max-w-full flex-wrap gap-0.5 justify-self-start rounded-menu border border-border bg-muted p-0.5', className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            'relative inline-flex cursor-pointer items-center rounded-control px-3 font-medium whitespace-nowrap text-text-secondary',
            size === 'sm' ? 'h-7 text-small' : 'h-8 text-body',
            'transition-[background-color,color,box-shadow] duration-120 hover:text-text',
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-accent',
            'has-checked:bg-surface has-checked:text-text has-checked:shadow-[0_1px_2px_rgb(11_11_12/0.08),0_0_0_1px_var(--color-border)]',
            'has-disabled:cursor-not-allowed has-disabled:opacity-50',
          )}
        >
          <input
            type="radio"
            name={group}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onValueChange(option.value)}
            className="absolute inset-0 size-full cursor-pointer appearance-none rounded-control opacity-0 disabled:cursor-not-allowed"
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}
