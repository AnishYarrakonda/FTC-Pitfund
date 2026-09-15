'use client'

import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

/*
 * A short label on hover or focus. Each tooltip carries its own provider so no app-wide provider
 * (and none of Radix's tooltip code) is needed on pages that don't show one.
 */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={16}
            data-motion="overlay"
            className="z-50 max-w-64 rounded-control bg-text px-2 py-1 text-caption text-white shadow-sm data-[state=delayed-open]:animate-overlay-in data-[state=closed]:animate-overlay-out"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
