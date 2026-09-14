'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { resetData } from '@/app/actions/dev'
import { ActionButton } from '@/components/ui/action-button'
import { SegmentedControl } from '@/components/ui/choice'

type Scenario = 'demo' | 'empty' | 'edge'

const DESCRIPTIONS: Record<Scenario, string> = {
  demo: '10 teams, 11 companies, 30 pitches in every status, real PDFs and logos.',
  empty: 'Personas and their orgs, with no content. For first-run and empty states.',
  edge: 'Demo pushed to every limit: 5,000-character words, a max-size PDF, the email quota nearly spent.',
}

export function ResetData() {
  const router = useRouter()
  const [scenario, setScenario] = useState<Scenario>('demo')
  return (
    <div className="grid gap-4 rounded-menu border border-border bg-surface p-4">
      <SegmentedControl<Scenario>
        label="Scenario"
        value={scenario}
        onValueChange={setScenario}
        options={[
          { value: 'demo', label: 'Demo' },
          { value: 'empty', label: 'Empty' },
          { value: 'edge', label: 'Edge' },
        ]}
      />
      <p className="text-body text-text-secondary">{DESCRIPTIONS[scenario]}</p>
      <div className="flex items-center gap-3">
        <ActionButton
          variant="secondary"
          pendingLabel="Resetting data…"
          successLabel="Data reset"
          action={() => resetData({ scenario })}
          successToast={`Reseeded the “${scenario}” scenario`}
          onSuccess={() => router.refresh()}
        >
          Reset data
        </ActionButton>
        <span className="text-small text-text-tertiary">Your persona stays signed in.</span>
      </div>
    </div>
  )
}
