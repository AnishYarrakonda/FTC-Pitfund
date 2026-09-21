import { cn } from '@/lib/shared/cn'

export type TeamSuggestion = {
  number: number
  name: string
  fullName: string | null
  city: string | null
  state: string | null
  country: string | null
  onPitfund: boolean
}

/** "Fremont, CA, USA": FIRST stores the parts separately. */
const suggestionPlace = (t: Pick<TeamSuggestion, 'city' | 'state' | 'country'>) => [t.city, t.state, t.country].filter(Boolean).join(', ')

/**
 * The list under the team finder's boxes (ARIA listbox; the boxes own focus and keys). Rows are
 * picked on mouse down so the box keeps focus and never blurs first.
 */
export function TeamSuggestions({
  id,
  suggestions,
  activeIndex,
  onPick,
  onHover,
  className,
}: {
  id: string
  suggestions: TeamSuggestion[]
  activeIndex: number
  onPick: (team: TeamSuggestion) => void
  onHover?: (index: number) => void
  className?: string
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Matching FIRST teams"
      className={cn('rounded-menu border border-border bg-surface py-1 shadow-sm', className)}
    >
      {suggestions.map((team, index) => {
        const place = suggestionPlace(team)
        const detail = [team.fullName && team.fullName !== team.name ? team.fullName : null, place].filter(Boolean).join(' · ')
        return (
          <li
            key={team.number}
            id={`${id}-${team.number}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(e) => {
              e.preventDefault()
              onPick(team)
            }}
            onMouseEnter={() => onHover?.(index)}
            className={cn('flex min-w-0 cursor-pointer items-start justify-between gap-3 px-3 py-2', index === activeIndex && 'bg-muted')}
          >
            <span className="grid min-w-0">
              <span className="text-body font-medium text-text user-text">
                <span className="tabular">{team.number}</span> · {team.name}
              </span>
              {detail ? <span className="text-small text-text-tertiary user-text">{detail}</span> : null}
            </span>
            {team.onPitfund ? <span className="mt-0.5 shrink-0 text-caption whitespace-nowrap text-text-secondary">On FTC Pitfund</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

/** Shown under a box when the search ran and found nothing. */
export function NoTeamMatches() {
  return <p className="text-small text-text-tertiary">No FIRST team matches that. Try another spelling, or your team number.</p>
}

