'use client'

import { useEffect } from 'react'
import { Toaster as Sonner } from 'sonner'

/** Sonner, styled to the tokens. Loaded by ./toaster.tsx on the first toast. */
export default function SonnerToaster({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady])
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      offset={16}
      mobileOffset={16}
      visibleToasts={3}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'group pointer-events-auto flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-menu border border-border bg-surface px-4 py-3 text-body text-text shadow-sm',
          title: 'font-medium text-text',
          description: 'text-small text-text-secondary',
          icon: 'mt-[3px] shrink-0 [&_svg]:size-4',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-danger',
          warning: '[&_[data-icon]]:text-warning',
          info: '[&_[data-icon]]:text-info',
          actionButton:
            'ml-auto shrink-0 rounded-control border border-border-strong bg-surface px-2.5 py-1 text-small font-medium text-text hover:bg-muted',
          cancelButton: 'ml-auto shrink-0 rounded-control px-2.5 py-1 text-small text-text-secondary hover:bg-muted',
          closeButton: 'text-text-tertiary',
        },
      }}
    />
  )
}
