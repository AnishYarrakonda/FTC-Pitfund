'use client'

import { Check, SearchX, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { createTeamAction, lookupTeam, requestToJoin } from '@/app/actions/team'
import { ActionButton } from '@/components/ui/action-button'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Banner } from '@/components/ui/banner'
import { Field } from '@/components/ui/field'
import { OrgLogo } from '@/components/ui/identity'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAction, useLatestAction } from '@/lib/client/use-action'
import { SUPPORT_EMAIL } from '@/lib/shared/brand'
import { MAX_LOCATION_LENGTH, MAX_TEAM_NAME_LENGTH, placeLabel } from '@/lib/shared/team'

/** FIRST stores city, state and country separately; we keep one line the team can edit. */
const recordLocation = (r: { city: string | null; state: string | null; country: string | null }) =>
  [r.city, r.state, r.country].filter(Boolean).join(', ')

type Source = 'matched' | 'manual' | 'unchecked'
type Details = { name: string; location: string; country: string | null }

const EMPTY: Details = { name: '', location: '', country: null }

/**
 * Coach first run (plan §3.2): number → debounced FIRST lookup → confirm or type details, or
 * request to join a team already on FTC Pitfund → 18+ and Terms → Create team.
 */
export function TeamSetup() {
  const router = useRouter()
  const [numberText, setNumberText] = useState('')
  const [source, setSource] = useState<Source | null>(null)
  const [details, setDetails] = useState<Details>(EMPTY)
  const [adult, setAdult] = useState(false)
  const [terms, setTerms] = useState(false)
  const lookup = useLatestAction(lookupTeam)
  const create = useAction(createTeamAction, { errorToast: false, onSuccess: (data) => router.push(data.redirectTo) })
  const detailsRef = useRef<HTMLDivElement>(null)

  const number = /^\d{1,6}$/.test(numberText) ? Number(numberText) : null
  const result = lookup.result?.ok && lookup.input?.number === number ? lookup.result.data : null
  const lookupError = lookup.result && !lookup.result.ok && lookup.input?.number === number ? lookup.result.error : null
  const checking = lookup.pending && lookup.input?.number === number

  // Debounced lookup from 4 digits; shorter (older) team numbers look up on Enter or blur.
  const { run: runLookup, cancel: cancelLookup } = lookup
  useEffect(() => {
    if (!number || numberText.length < 4) return
    const timer = setTimeout(() => void runLookup({ number }), 400)
    return () => clearTimeout(timer)
  }, [number, numberText.length, runLookup])

  const changeNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setNumberText(digits)
    setSource(null)
    setDetails(EMPTY)
    create.reset()
    if (digits.length === 0) cancelLookup()
  }

  const lookUpNow = () => {
    if (number && !checking && lookup.input?.number !== number) void runLookup({ number })
  }

  const enterManually = (next: Source) => {
    setSource(next)
    setDetails(EMPTY)
    requestAnimationFrame(() => detailsRef.current?.querySelector('input')?.focus())
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!number || !source) return
    void create.run({ number, ...details, source, adult: adult as true, terms: terms as true })
  }

  const errors = create.fieldErrors
  const showDetails = source !== null

  return (
    <form noValidate onSubmit={submit} className="mt-10 grid gap-8">
      <Field
        label="FTC team number"
        required
        error={errors.number}
        hint={numberText.length > 0 && numberText.length < 4 && !result ? 'Press Enter to look up a shorter team number.' : 'The number FIRST assigned your team, like 31579.'}
      >
        <Input
          value={numberText}
          onChange={(e) => changeNumber(e.target.value)}
          onBlur={lookUpNow}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              lookUpNow()
            }
          }}
          inputMode="numeric"
          autoComplete="off"
          placeholder="31579"
          className="max-w-48 text-lead tabular"
          aria-label="FTC team number"
        />
      </Field>

      <div aria-live="polite" className="empty:hidden">
        {checking ? (
          <p className="flex items-center gap-2 text-body text-text-secondary">
            <Spinner className="text-accent" /> Checking FIRST records…
          </p>
        ) : lookupError ? (
          <Banner
            tone="danger"
            title={lookupError.message}
            action={
              <Button variant="secondary" size="sm" onClick={() => number && void runLookup({ number })}>
                Retry
              </Button>
            }
          />
        ) : result?.status === 'found' && source === null ? (
          <div className="grid gap-4 rounded-menu border border-border bg-surface p-5">
            <p className="text-lead text-text user-text">
              <span className="font-semibold">
                Team {result.record.number} · {result.record.name}
              </span>
              {recordLocation(result.record) ? <span className="text-text-secondary"> · {recordLocation(result.record)}</span> : null}
            </p>
            <p className="text-body text-text-secondary">Is this your team?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setSource('matched')
                  setDetails({ name: result.record.name.slice(0, MAX_TEAM_NAME_LENGTH), location: recordLocation(result.record), country: result.record.country })
                }}
              >
                <Check aria-hidden="true" />
                Yes, that’s my team
              </Button>
              <Button variant="ghost" onClick={() => enterManually('manual')}>
                No, enter details myself
              </Button>
            </div>
          </div>
        ) : result?.status === 'not_found' && source === null ? (
          <Notice icon={<SearchX aria-hidden="true" className="size-4" />}>
            <p className="text-body text-text">
              No FTC team {number} in FIRST records. Check the number, or continue and enter the name and city yourself.
            </p>
            <div>
              <Button variant="secondary" onClick={() => enterManually('manual')}>
                Enter details myself
              </Button>
            </div>
          </Notice>
        ) : result?.status === 'unavailable' && source === null ? (
          <Notice icon={<WifiOff aria-hidden="true" className="size-4" />}>
            <p className="text-body text-text">FIRST records aren’t reachable right now. Enter your team name and city; we’ll check them later.</p>
            <div>
              <Button variant="secondary" onClick={() => enterManually('unchecked')}>
                Enter details
              </Button>
            </div>
          </Notice>
        ) : result?.status === 'on_pitfund' ? (
          <div className="grid gap-4 rounded-menu border border-border bg-surface p-5">
            <div className="flex min-w-0 items-center gap-3">
              <OrgLogo name={result.team.name} src={result.team.logoUrl} size="md" />
              <div className="grid min-w-0">
                <p className="text-body font-semibold text-text user-text">
                  Team {result.team.number} · {result.team.name}
                </p>
                {placeLabel(result.team) ? <p className="text-small text-text-tertiary user-text">{placeLabel(result.team)}</p> : null}
              </div>
            </div>
            {result.team.suspended ? (
              <p className="text-body text-text-secondary">
                This team is on FTC Pitfund but can’t accept new members right now. Email {SUPPORT_EMAIL} for help.
              </p>
            ) : (
              <>
                <p className="text-body text-text-secondary">
                  This team is already on FTC Pitfund. Ask to join it, and one of its coaches can approve you.
                </p>
                <div>
                  <ActionButton
                    action={() => requestToJoin({ teamId: result.team.id })}
                    pendingLabel="Sending request…"
                    onSuccess={() => {
                      router.push('/welcome')
                      router.refresh()
                    }}
                  >
                    Request to join
                  </ActionButton>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {showDetails ? (
        <div ref={detailsRef} className="grid gap-5 border-t border-border pt-8">
          {source === 'matched' ? (
            <p className="flex items-start gap-2 text-body text-text-secondary">
              <Check aria-hidden="true" className="mt-[3px] size-4 shrink-0 text-success" /> Found in FIRST records. You can edit these later on your team page.
            </p>
          ) : null}
          <Field label="Team name" required error={errors.name}>
            <Input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} maxLength={MAX_TEAM_NAME_LENGTH} autoComplete="organization" />
          </Field>
          <Field label="Location" hint="Where your team is based, however you’d say it." required error={errors.location}>
            <Input
              value={details.location}
              onChange={(e) => setDetails({ ...details, location: e.target.value })}
              maxLength={MAX_LOCATION_LENGTH}
              autoComplete="address-level2"
              placeholder="Austin, Texas, USA"
            />
          </Field>
        </div>
      ) : null}

      {showDetails ? (
        <div className="grid gap-4 border-t border-border pt-8">
          <Checkbox checked={adult} onCheckedChange={setAdult} label="I’m 18 or older and I coach or mentor this team" error={errors.adult} />
          <Checkbox
            checked={terms}
            onCheckedChange={setTerms}
            error={errors.terms}
            label={
              <>
                I accept the{' '}
                <Link href="/legal/terms" target="_blank" className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
                  Terms
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy" target="_blank" className="font-medium text-accent underline underline-offset-4 hover:text-accent-hover">
                  Privacy Policy
                </Link>
              </>
            }
          />
        </div>
      ) : null}

      {showDetails ? (
        <div className="grid gap-3">
          {create.error && !Object.keys(create.fieldErrors).length ? (
            <p role="alert" className="text-body text-danger">
              {create.error.message}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small text-text-tertiary">You can invite other coaches once the team exists.</p>
            <Button type="submit" size="lg" data-action-button="" loading={create.pending} loadingLabel="Creating team…">
              Create team
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  )
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-menu border border-border bg-surface p-5">
      <span className="mt-[3px] shrink-0 text-text-tertiary">{icon}</span>
      <div className="grid min-w-0 gap-4">{children}</div>
    </div>
  )
}
