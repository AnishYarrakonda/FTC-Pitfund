'use client'

import { Tabs as TabsPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

export const TabsContent = TabsPrimitive.Content

/** min-w-0 lets a long tab row scroll inside a grid or flex column instead of widening it. */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('min-w-0', className)} {...props} />
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex max-w-full gap-5 overflow-x-auto border-b border-border [scrollbar-width:none]', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, count, children, ...props }: ComponentProps<typeof TabsPrimitive.Trigger> & { count?: number; children: ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 border-transparent text-body font-medium whitespace-nowrap text-text-secondary',
        'transition-colors duration-120 hover:text-text',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        'data-[state=active]:border-text data-[state=active]:text-text',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? (
        <span className="inline-grid h-5 min-w-5 place-items-center rounded-control bg-muted px-1.5 text-caption font-medium text-text-secondary tabular">
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  )
}
