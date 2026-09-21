'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'

import { cn } from '@/lib/shared/cn'

import { useFieldControl } from './field'
import { controlClasses } from './input'

type TextareaProps = ComponentProps<'textarea'> & {
  /** Rows visible before the field starts growing. */
  minRows?: number
  /** Stop growing here and scroll instead. */
  maxRows?: number
  /** Show "n / max" from 80% of maxLength (plan §3.2), or always. */
  counter?: 'near-limit' | 'always' | 'never'
}

const LINE = 22
const PADDING_Y = 16

/** Auto-growing textarea with an accessible length counter. */
export function Textarea({ className, minRows = 3, maxRows = 16, counter = 'near-limit', maxLength, onChange, ...props }: TextareaProps) {
  const field = useFieldControl(props)
  const ref = useRef<HTMLTextAreaElement>(null)
  const [uncontrolledLength, setLength] = useState(() => String(props.defaultValue ?? '').length)
  const length = props.value !== undefined ? String(props.value).length : uncontrolledLength
  const counterId = field.id ? `${field.id}-counter` : undefined

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const min = minRows * LINE + PADDING_Y
    const max = maxRows * LINE + PADDING_Y
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight + 2))}px`
    el.style.overflowY = el.scrollHeight + 2 > max ? 'auto' : 'hidden'
  }

  useLayoutEffect(() => {
    resize()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resize reads the DOM; re-run only when the value changes
  }, [props.value])

  // A narrower or wider window re-wraps the text, so the height has to be measured again.
  useEffect(() => {
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resize only reads refs and props that are stable per render
  }, [])

  const showCounter =
    maxLength !== undefined && (counter === 'always' || (counter === 'near-limit' && length >= maxLength * 0.8))
  const over = maxLength !== undefined && length >= maxLength

  return (
    <div className="relative min-w-0">
      <textarea
        {...props}
        {...field}
        ref={ref}
        maxLength={maxLength}
        aria-describedby={[field['aria-describedby'], showCounter ? counterId : undefined].filter(Boolean).join(' ') || undefined}
        rows={minRows}
        onChange={(e) => {
          setLength(e.target.value.length)
          resize()
          onChange?.(e)
        }}
        className={cn(controlClasses, 'block resize-none px-3 py-2 leading-[22px] user-text-block', className)}
      />
      {showCounter ? (
        <p
          id={counterId}
          aria-live="polite"
          className={cn('mt-1.5 text-right text-caption tabular', over ? 'text-danger' : 'text-text-tertiary')}
        >
          {length.toLocaleString('en-US')} / {maxLength!.toLocaleString('en-US')}
        </p>
      ) : null}
    </div>
  )
}
