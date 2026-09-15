'use client'

import { DropdownMenu, Popover as PopoverPrimitive, Slot, Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/* Menu (dropdown), Popover and Tooltip. Menus and popovers: 8 px radius, shadow-sm. */

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({ className, align = 'end', sideOffset = 6, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        data-motion="overlay"
        className={cn(
          'z-50 min-w-52 max-w-[calc(100vw-32px)] overflow-hidden rounded-menu border border-border bg-surface p-1 shadow-sm',
          'data-[state=open]:animate-content-in data-[state=closed]:animate-content-out',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function MenuItem({
  className,
  tone = 'default',
  icon,
  children,
  asChild,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { tone?: 'default' | 'danger'; icon?: ReactNode }) {
  return (
    <DropdownMenu.Item
      asChild={asChild}
      className={cn(
        'flex h-8 cursor-default select-none items-center gap-2.5 rounded-control px-2.5 text-body outline-none',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        tone === 'danger' ? 'text-danger data-[highlighted]:bg-danger-subtle' : 'text-text data-[highlighted]:bg-muted [&_svg]:text-text-tertiary',
        'data-[disabled]:text-text-tertiary',
        className,
      )}
      {...props}
    >
      {asChild ? (
        // With asChild the child (e.g. a Link) becomes the item and the icon is slotted inside
        // it. Slot needs these as sibling children, not wrapped in a Fragment.
        [
          <span key="icon" className="contents">
            {icon}
          </span>,
          <Slot.Slottable key="item">{children}</Slot.Slottable>,
        ]
      ) : (
        <>
          {icon}
          <span className="min-w-0 truncate">{children}</span>
        </>
      )}
    </DropdownMenu.Item>
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn('px-2.5 pt-2 pb-1.5 text-caption font-medium text-text-tertiary', className)} {...props} />
}

export function MenuSeparator({ className }: { className?: string }) {
  return <DropdownMenu.Separator className={cn('-mx-1 my-1 h-px bg-border', className)} />
}

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({ className, align = 'end', sideOffset = 6, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        data-motion="overlay"
        className={cn(
          'z-50 w-[min(380px,calc(100vw-32px))] rounded-menu border border-border bg-surface shadow-sm focus:outline-none',
          'data-[state=open]:animate-content-in data-[state=closed]:animate-content-out',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
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
  )
}
