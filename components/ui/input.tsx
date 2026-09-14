'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type ComponentProps } from 'react'

import { cn } from '@/lib/shared/cn'

import { useFieldControl } from './field'

export const controlClasses = cn(
  'w-full min-w-0 rounded-control border border-border-strong bg-surface text-body text-text',
  'placeholder:text-text-tertiary',
  'transition-[border-color,box-shadow] duration-120 ease-out',
  'hover:border-text-tertiary',
  'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-text-tertiary disabled:hover:border-border-strong',
  'read-only:bg-canvas read-only:text-text-secondary read-only:hover:border-border-strong read-only:focus-visible:ring-0',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20',
)

export function Input({ className, ...props }: ComponentProps<'input'>) {
  const field = useFieldControl(props)
  return <input {...props} {...field} className={cn(controlClasses, 'h-9 px-3', className)} />
}

type SearchInputProps = Omit<ComponentProps<'input'>, 'onChange' | 'value' | 'defaultValue' | 'type'> & {
  value?: string
  defaultValue?: string
  /** Called after the user stops typing (debounced). */
  onSearch: (value: string) => void
  debounceMs?: number
  label: string
}

/** Search field with an icon, a clear button and a debounced callback. */
export function SearchInput({ value, defaultValue = '', onSearch, debounceMs = 250, label, className, ...props }: SearchInputProps) {
  const [text, setText] = useState(value ?? defaultValue)
  // The last query handed to onSearch: re-running effects (StrictMode, a new onSearch after
  // navigation) must not search again for text that hasn't changed.
  const searched = useRef((value ?? defaultValue).trim())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const query = text.trim()
    if (query === searched.current) return
    const timer = setTimeout(() => {
      searched.current = query
      onSearch(query)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [text, debounceMs, onSearch])

  return (
    <div className={cn('relative min-w-0', className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" />
      <input
        {...props}
        ref={inputRef}
        type="search"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={cn(controlClasses, 'h-9 pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none')}
      />
      {text ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setText('')
            searched.current = ''
            onSearch('')
            inputRef.current?.focus()
          }}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded-control text-text-tertiary hover:bg-muted hover:text-text"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
