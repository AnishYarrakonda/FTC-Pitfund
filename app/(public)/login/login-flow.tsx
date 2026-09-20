'use client'

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { requestLoginCode, verifyLoginCode } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/banner'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAction } from '@/lib/client/use-action'
import { cn } from '@/lib/shared/cn'
import { NETWORK_ERROR_MESSAGE } from '@/lib/shared/result'
import { parseIntent, safeNext } from '@/lib/shared/sign-in'

/*
 * Sign in (plan §3.2): a 6-digit email code. Every branch has its own copy: sending, wrong
 * code, expired code, rate limited, email couldn't be sent, network down. Supabase can't tell
 * a wrong code from an expired one, so expiry is judged from when the code was sent (10 minutes).
 */

const CODE_TTL_MS = 10 * 60 * 1000
const RESEND_AFTER_MS = 30 * 1000

const SUBTITLE = {
  team: 'Sign in to set up your team. No password needed.',
  company: 'Sign in to set up your company. No password needed.',
  any: 'Coaches and company teams both sign in here. No password needed.',
}

const noSubscription = () => () => {}

type CodeError = { kind: 'invalid' | 'expired' | 'rate' | 'network' | 'other'; message: string }

export function LoginFlow() {
  const router = useRouter()
  // Read in the browser so the page stays static: ?intent (from the landing page; preselects the
  // /welcome branch), ?next, ?signed_out and ?deleted.
  const search = useSyncExternalStore(noSubscription, () => window.location.search, () => '')
  const params = new URLSearchParams(search)
  const next = safeNext(params.get('next')) ?? undefined
  const intent = parseIntent(params.get('intent'))
  const notice = params.has('signed_out') ? 'You’re signed out.' : params.has('deleted') ? 'Your account was deleted.' : null
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentAt, setSentAt] = useState(0)
  // Set when a code is sent; the resend countdown only runs on the code step.
  const [now, setNow] = useState(0)
  const [codeError, setCodeError] = useState<CodeError | null>(null)
  const [resent, setResent] = useState(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const lastSubmitted = useRef('')

  // Tick once a second while the resend countdown is running.
  useEffect(() => {
    if (step !== 'code') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [step])

  const send = useAction(requestLoginCode, {
    errorToast: false,
    onSuccess: (data, input) => {
      setEmail(input.email)
      setSentAt(data.sentAt)
      setNow(Date.now())
      setCode('')
      lastSubmitted.current = ''
      setCodeError(null)
      setResent(step === 'code')
      setStep('code')
      requestAnimationFrame(() => codeInput.current?.focus())
    },
  })

  const verify = useAction(verifyLoginCode, {
    errorToast: false,
    onSuccess: (data) => {
      router.replace(data.redirectTo)
      router.refresh()
    },
    onError: (error) => {
      if (error.code === 'UNAVAILABLE' && error.message === NETWORK_ERROR_MESSAGE) {
        setCodeError({ kind: 'network', message: error.message })
      } else if (error.code === 'RATE_LIMITED') {
        setCodeError({ kind: 'rate', message: error.message })
      } else if (error.code === 'VALIDATION' && Date.now() - sentAt > CODE_TTL_MS) {
        setCodeError({ kind: 'expired', message: 'That code has expired.' })
      } else if (error.code === 'VALIDATION') {
        setCodeError({ kind: 'invalid', message: "That code isn't right. Check the latest email." })
      } else {
        setCodeError({ kind: 'other', message: error.message })
      }
      requestAnimationFrame(() => codeInput.current?.select())
    },
  })

  const submitCode = (value: string) => {
    if (value.length !== 6 || verify.pending || value === lastSubmitted.current) return
    lastSubmitted.current = value
    setCodeError(null)
    setResent(false)
    void verify.run({ email, code: value, next, intent: intent ?? undefined })
  }

  const resendIn = Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000))
  const emailError = send.fieldErrors.email ?? (send.error && !send.error.field ? send.error.message : null)

  if (step === 'code') {
    return (
      <section className="grid gap-6" aria-labelledby="code-heading">
        <div className="grid gap-2">
          <h1 id="code-heading" className="text-h2 font-semibold tracking-tighter text-text">
            Check your email
          </h1>
          <p className="text-body text-text-secondary">
            We sent a 6-digit code to <span className="font-medium text-text user-text">{email}</span>. It expires in 10 minutes.
          </p>
        </div>

        {resent && !codeError ? (
          <p className="text-small text-success" role="status">
            We sent a new code. Use the latest email.
          </p>
        ) : null}

        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            lastSubmitted.current = ''
            submitCode(code)
          }}
        >
          <Field label="Sign-in code" error={codeError && codeError.kind !== 'expired' ? codeError.message : null}>
            <Input
              ref={codeInput}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              readOnly={verify.pending}
              placeholder="000000"
              aria-busy={verify.pending || undefined}
              className="h-12 text-center font-mono text-h3 tracking-[0.4em] tabular placeholder:tracking-[0.4em] placeholder:text-border-strong"
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(digits)
                if (codeError?.kind === 'invalid') setCodeError(null)
                if (digits.length === 6) submitCode(digits)
              }}
            />
          </Field>

          {codeError?.kind === 'expired' ? (
            <Banner
              tone="warning"
              title="That code has expired."
              action={
                <Button size="sm" variant="secondary" data-action-button="" loading={send.pending} loadingLabel="Sending…" onClick={() => void send.run({ email })}>
                  Send a new code
                </Button>
              }
            />
          ) : null}
          {codeError?.kind === 'network' ? (
            <Button variant="secondary" onClick={() => { lastSubmitted.current = ''; submitCode(code) }}>
              Retry
            </Button>
          ) : null}

          <Button type="submit" size="lg" data-action-button="" loading={verify.pending} loadingLabel="Signing you in…" disabled={code.length !== 6 && !verify.pending}>
            Sign in
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-small">
          <button
            type="button"
            onClick={() => {
              setStep('email')
              setCodeError(null)
              setResent(false)
              send.reset()
            }}
            className="inline-flex items-center gap-1.5 rounded-control font-medium text-text-secondary hover:text-text"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Use a different email
          </button>
          <button
            type="button"
            disabled={resendIn > 0 || send.pending}
            aria-disabled={resendIn > 0 || send.pending}
            onClick={() => void send.run({ email })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-control font-medium',
              resendIn > 0 ? 'cursor-not-allowed text-text-tertiary' : 'text-accent hover:text-accent-hover',
            )}
          >
            {send.pending ? <Spinner size={12} /> : null}
            {send.pending ? 'Sending…' : resendIn > 0 ? <span className="tabular">Resend code (in {resendIn}s)</span> : 'Resend code'}
          </button>
        </div>
        {send.error ? (
          <p role="alert" className="text-small text-danger">
            {send.error.message}
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section className="grid gap-6" aria-labelledby="login-heading">
      <div className="grid gap-2">
        <h1 id="login-heading" className="text-h2 font-semibold tracking-tighter text-text">
          Sign in
        </h1>
        <p className="text-body text-text-secondary">{SUBTITLE[intent ?? 'any']}</p>
      </div>

      {notice ? (
        <p role="status" className="text-small text-text-secondary">
          {notice}
        </p>
      ) : null}

      <form
        noValidate
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void send.run({ email })
        }}
      >
        <Field label="Email" error={emailError}>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (send.error) send.reset()
            }}
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="h-11"
            spellCheck={false}
          />
        </Field>
        {send.error?.code === 'UNAVAILABLE' && send.error.message === NETWORK_ERROR_MESSAGE ? (
          <Button variant="secondary" onClick={() => void send.retry()}>
            Retry
          </Button>
        ) : null}
        <Button type="submit" size="lg" className="w-full" data-action-button="" loading={send.pending} loadingLabel="Sending code…">
          Email me a code
        </Button>
      </form>
    </section>
  )
}
