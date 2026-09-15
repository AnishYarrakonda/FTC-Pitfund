'use client'

import { useRouter } from 'next/navigation'

import { checkDeck, createUploadUrl, saveDeck } from '@/app/actions/team'
import { DeckUpload, type DeckInfo } from '@/components/uploads/deck-upload'
import { FormSection } from '@/components/ui/field'

export function DeckSection({ deck }: { deck: DeckInfo }) {
  const router = useRouter()
  return (
    <FormSection
      id="deck"
      title="Sponsorship deck"
      description="One PDF, up to 5 pages. Companies read it on your public page and alongside every pitch."
    >
      <DeckUpload
        deck={deck}
        actions={{
          createUpload: (purpose, imageType) => createUploadUrl({ purpose, imageType }),
          check: (path) => checkDeck({ path }),
          save: (input) => saveDeck(input),
        }}
        onSaved={() => router.refresh()}
      />
    </FormSection>
  )
}
