'use client'

import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive, RadioGroup } from 'radix-ui'
import { useId, type ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/* Checkbox, RadioCards and SegmentedControl: every choice control in the product. */

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
        <CheckboxPrimitive.Root
          {...props}
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          onCheckedChange={(v) => onCheckedChange?.(v === true)}
          className={cn(
            'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border border-border-strong bg-surface',
            'transition-colors duration-120 hover:border-text-tertiary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
            'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger',
          )}
        >
          <CheckboxPrimitive.Indicator>
            <Check aria-hidden="true" className="size-3 text-white" strokeWidth={3} />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
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

type ChoiceOption<V extends string> = { value: V; label: ReactNode; description?: ReactNode; disabled?: boolean }

type RadioCardsProps<V extends string> = {
  options: ChoiceOption<V>[]
  value?: V
  defaultValue?: V
  onValueChange?: (value: V) => void
  name?: string
  label: string
  className?: string
  columns?: 1 | 2
}

/** Large radio options with a title and description (e.g. the welcome role choice). */
export function RadioCards<V extends string>({ options, onValueChange, label, className, columns = 2, ...props }: RadioCardsProps<V>) {
  return (
    <RadioGroup.Root
      {...props}
      aria-label={label}
      onValueChange={(v) => onValueChange?.(v as V)}
      className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2', className)}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            'group relative grid min-w-0 gap-1 rounded-menu border border-border-strong bg-surface p-4 pr-10 text-left',
            'transition-[border-color,box-shadow,background-color] duration-120 hover:border-text-tertiary',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'data-[state=checked]:border-accent data-[state=checked]:bg-accent-subtle/40 data-[state=checked]:shadow-[inset_0_0_0_1px_var(--color-accent)]',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          <span className="text-body font-medium text-text">{option.label}</span>
          {option.description ? <span className="text-small text-text-secondary">{option.description}</span> : null}
          <span
            aria-hidden="true"
            className="absolute top-4 right-4 grid size-4 place-items-center rounded-full border border-border-strong bg-surface group-data-[state=checked]:border-accent"
          >
            <RadioGroup.Indicator className="size-2 rounded-full bg-accent" />
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
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
export function SegmentedControl<V extends string>({ options, onValueChange, label, className, size = 'md', ...props }: SegmentedProps<V>) {
  return (
    <RadioGroup.Root
      {...props}
      aria-label={label}
      orientation="horizontal"
      onValueChange={(v) => onValueChange(v as V)}
      className={cn('inline-flex w-fit max-w-full flex-wrap gap-0.5 justify-self-start rounded-menu border border-border bg-muted p-0.5', className)}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            'rounded-control px-3 font-medium whitespace-nowrap text-text-secondary',
            size === 'sm' ? 'h-7 text-small' : 'h-8 text-body',
            'transition-[background-color,color,box-shadow] duration-120 hover:text-text',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            'data-[state=checked]:bg-surface data-[state=checked]:text-text data-[state=checked]:shadow-[0_1px_2px_rgb(11_11_12/0.08),0_0_0_1px_var(--color-border)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
