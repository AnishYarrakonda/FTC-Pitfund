'use client'

import { useId, useState, type ReactNode } from 'react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/shared/cn'

import { NoTeamMatches, TeamSuggestions, type TeamSuggestion } from './team-suggestions'

/**
 * A box in the team finder: a text field with a list of matching FIRST teams under it (ARIA
 * combobox). Arrow keys move through the list, Enter picks, Esc closes. Enter with nothing
 * highlighted falls through to `onEnter`, so a bare number still looks itself up.
 */
export function TeamFinderInput({
  label,
  hint,
  error,
  required,
  value,
  onValueChange,
  suggestions,
  searching,
  noMatches,
  onPick,
  onEnter,
  onBlurValue,
  inputMode,
  placeholder,
  className,
  ariaLabel,
  aside,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  required?: boolean
  value: string
  onValueChange: (value: string) => void
  suggestions: TeamSuggestion[]
  searching: boolean
  noMatches: boolean
  onPick: (team: TeamSuggestion) => void
  onEnter?: () => void
  onBlurValue?: () => void
  inputMode?: 'numeric' | 'text'
  placeholder?: string
  className?: string
  ariaLabel: string
  aside?: ReactNode
}) {
  const listId = useId()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  const [dismissed, setDismissed] = useState(false)
  const open = focused && !dismissed && suggestions.length > 0
  const activeId = open && active >= 0 && suggestions[active] ? `${listId}-${suggestions[active].number}` : undefined

  return (
    <Field label={label} hint={hint} error={error} required={required} aside={aside}>
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => {
            setDismissed(false)
            setActive(-1)
            onValueChange(e.target.value)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setActive(-1)
            onBlurValue?.()
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && suggestions.length) {
              e.preventDefault()
              setDismissed(false)
              setActive((i) => (i + 1) % suggestions.length)
            } else if (e.key === 'ArrowUp' && suggestions.length) {
              e.preventDefault()
              setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
            } else if (e.key === 'Escape' && open) {
              e.preventDefault()
              setDismissed(true)
              setActive(-1)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const chosen = open ? suggestions[active] : undefined
              if (chosen) {
                setActive(-1)
                onPick(chosen)
              } else onEnter?.()
            }
          }}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          className={cn(searching && 'pr-9', className)}
        />
        {searching ? <Spinner className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-tertiary" size={14} /> : null}
        {open ? (
          <TeamSuggestions
            id={listId}
            suggestions={suggestions}
            activeIndex={active}
            onHover={setActive}
            onPick={(team) => {
              setActive(-1)
              onPick(team)
            }}
            className="absolute top-full left-0 z-20 mt-1 w-[min(28rem,calc(100vw-2rem))]"
          />
        ) : null}
      </div>
      {noMatches && !searching && !open ? <NoTeamMatches /> : null}
    </Field>
  )
}
