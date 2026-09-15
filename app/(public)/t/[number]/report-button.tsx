'use client'

import { Flag } from 'lucide-react'
import { useState, type ComponentType } from 'react'

import { Button } from '@/components/ui/button'

type ReportDialogProps = { teamNumber: number; open: boolean; setOpen: (open: boolean) => void }

/*
 * The "Report this page" trigger. The dialog (Radix Dialog and Select, the form, the action) is
 * loaded on the first click so it stays out of the team page's first-load JS (plan §6).
 */
export function ReportButton({ teamNumber }: { teamNumber: number }) {
  const [Dialog, setDialog] = useState<ComponentType<ReportDialogProps> | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const openDialog = async () => {
    if (Dialog) return setOpen(true)
    setLoading(true)
    try {
      const mod = await import('./report-dialog')
      setDialog(() => mod.default)
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-qa-overlay="Report this page"
        loading={loading}
        loadingLabel="Opening…"
        onClick={() => void openDialog()}
      >
        <Flag aria-hidden="true" />
        Report this page
      </Button>
      {Dialog ? <Dialog teamNumber={teamNumber} open={open} setOpen={setOpen} /> : null}
    </>
  )
}
