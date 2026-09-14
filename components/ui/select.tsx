'use client'

import { Check, ChevronDown } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'

import { cn } from '@/lib/shared/cn'

import { useFieldControl } from './field'
import { controlClasses } from './input'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type SelectProps = {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  name?: string
  id?: string
  className?: string
  'aria-label'?: string
  'aria-invalid'?: boolean
}

export function Select({ options, placeholder = 'Choose…', className, id, 'aria-invalid': ariaInvalid, 'aria-label': ariaLabel, ...props }: SelectProps) {
  const field = useFieldControl({ id, 'aria-invalid': ariaInvalid })
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        id={field.id}
        aria-label={ariaLabel}
        aria-describedby={field['aria-describedby']}
        aria-invalid={field['aria-invalid']}
        className={cn(
          controlClasses,
          'flex h-9 items-center justify-between gap-2 px-3 text-left data-[placeholder]:text-text-tertiary',
          className,
        )}
      >
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown aria-hidden="true" className="size-4 text-text-tertiary" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          data-motion="overlay"
          className={cn(
            'z-50 max-h-[min(var(--radix-select-content-available-height),320px)] min-w-[var(--radix-select-trigger-width)] overflow-hidden',
            'rounded-menu border border-border bg-surface shadow-sm',
            'data-[state=open]:animate-content-in data-[state=closed]:animate-content-out',
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex h-8 cursor-default select-none items-center rounded-control pr-8 pl-2.5 text-body text-text outline-none',
                  'data-[highlighted]:bg-muted data-[disabled]:text-text-tertiary',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5">
                  <Check aria-hidden="true" className="size-4 text-accent" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
