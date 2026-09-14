'use client'

import { Check } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { useAction, type UseActionOptions } from '@/lib/client/use-action'
import type { Result } from '@/lib/shared/result'

import { Button, type ButtonProps } from './button'

type ActionButtonProps<T> = Omit<ButtonProps, 'onClick' | 'loading' | 'loadingLabel' | 'children'> &
  UseActionOptions<void, T> & {
    action: () => Promise<Result<T>>
    children: ReactNode
    /** Verb label while working, e.g. "Submitting…". Required: no bare spinners. */
    pendingLabel: ReactNode
    /** Optional in-place success label, e.g. "Sent". Shown with a check for 2 s. */
    successLabel?: ReactNode
  }

/**
 * Every button that triggers async work (plan §3.1 #1). The pending state renders in the
 * same frame as the click (a transition's isPending is an urgent update), sets aria-busy,
 * and ignores further clicks until the action settles.
 */
export function ActionButton<T>({
  action,
  children,
  pendingLabel,
  successLabel,
  onSuccess,
  onError,
  successToast,
  errorToast,
  ...props
}: ActionButtonProps<T>) {
  const [showSuccess, setShowSuccess] = useState(false)
  const { run, pending } = useAction(() => action(), {
    onSuccess: async (data) => {
      if (successLabel) setShowSuccess(true)
      await onSuccess?.(data)
    },
    onError,
    successToast,
    errorToast,
  })

  useEffect(() => {
    if (!showSuccess) return
    const timer = setTimeout(() => setShowSuccess(false), 2000)
    return () => clearTimeout(timer)
  }, [showSuccess])

  return (
    <Button
      {...props}
      data-action-button=""
      loading={pending}
      loadingLabel={pendingLabel}
      onClick={() => void run()}
    >
      {showSuccess && !pending ? (
        <>
          <Check aria-hidden="true" />
          {successLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

/** Submit button for `<form action={…}>`: pending comes from useFormStatus. */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingOverride,
  ...props
}: Omit<ButtonProps, 'type' | 'loading' | 'loadingLabel'> & { pendingLabel: ReactNode; pending?: boolean }) {
  const status = useFormStatus()
  const pending = pendingOverride ?? status.pending
  return (
    <Button {...props} type="submit" data-action-button="" loading={pending} loadingLabel={pendingLabel}>
      {children}
    </Button>
  )
}
