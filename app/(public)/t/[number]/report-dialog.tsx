'use client'

import { CheckCircle2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { reportTeamPage } from '@/app/actions/reports'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/banner'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAction } from '@/lib/client/use-action'
import { REPORT_REASONS } from '@/lib/shared/team'

/**
 * "Report this page": reason, details, optional email. Bot-checked on the server. Loaded on the
 * first click by ./report-button.tsx, which owns the trigger and the open state.
 */
export default function ReportDialog({ teamNumber, open, setOpen }: { teamNumber: number; open: boolean; setOpen: (open: boolean) => void }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { run, pending, fieldErrors, error, reset } = useAction(reportTeamPage, { errorToast: false, onSuccess: () => setSent(true) })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run({ teamNumber, reason, details, email })
  }

  const close = (next: boolean) => {
    if (pending) return
    setOpen(next)
    if (!next) {
      reset()
      if (sent) {
        setSent(false)
        setReason('')
        setDetails('')
        setEmail('')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        size="md"
        title="Report this page"
        description="Tell us what’s wrong. A person on the FTC Pitfund team reviews every report."
        dismissible={!pending}
        footer={
          sent ? (
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="secondary" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="report-form" data-action-button="" loading={pending} loadingLabel="Sending report…">
                Send report
              </Button>
            </>
          )
        }
      >
        {sent ? (
          <p role="status" className="flex items-start gap-2 text-body text-text">
            <CheckCircle2 aria-hidden="true" className="mt-[3px] size-4 shrink-0 text-success" />
            Thanks. We&apos;ll review this page.
          </p>
        ) : (
          <form id="report-form" noValidate onSubmit={submit} className="grid gap-5">
            <Field label="Reason" required error={fieldErrors.reason}>
              <Select value={reason || undefined} onValueChange={setReason} placeholder="Choose a reason" options={REPORT_REASONS.map((r) => ({ value: r.value, label: r.label }))} />
            </Field>
            <Field label="Details" hint="Optional. What should we look at?" error={fieldErrors.details}>
              <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} minRows={3} maxRows={8} />
            </Field>
            <Field label="Your email" hint="Optional. Only if you’d like us to follow up." error={fieldErrors.email}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            {error && !Object.keys(fieldErrors).length ? <Banner tone="danger" title={error.message} /> : null}
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
