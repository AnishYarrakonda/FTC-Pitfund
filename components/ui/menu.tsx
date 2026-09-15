'use client'

import { DropdownMenu, Popover as PopoverPrimitive, Slot } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

/* Menu (dropdown) and Popover. Menus and popovers: 8 px radius, shadow-sm. */

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
