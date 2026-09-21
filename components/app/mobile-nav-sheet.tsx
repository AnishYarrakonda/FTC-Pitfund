'use client'

import { Menu as MenuIcon, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { startTransition, useState } from 'react'

import { signOut } from '@/app/actions/auth'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/lib/shared/cn'
import { isActive } from '@/lib/shared/nav'

import type { MobileNavProps } from './mobile-nav'

/** The menu sheet, loaded by ./mobile-nav.tsx on first touch, focus or click. */
export default function MobileNavSheet({ items, secondary, name, email, defaultOpen }: MobileNavProps & { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const pathname = usePathname()
  const linkClass = 'flex h-11 items-center rounded-control px-3 text-lead font-medium transition-colors duration-120'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <IconButton label="Open menu" icon={<MenuIcon aria-hidden="true" />} className="sm:hidden" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-motion="overlay"
          className="fixed inset-0 z-50 bg-text/30 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out sm:hidden"
        />
        <DialogPrimitive.Content
          data-overlay="sheet"
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-dialog border-t border-border bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-lg data-[state=open]:animate-content-in data-[state=closed]:animate-content-out focus:outline-none sm:hidden"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div className="grid min-w-0">
              <DialogPrimitive.Title className="truncate text-body font-semibold text-text">{name}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="truncate text-small text-text-tertiary">{email}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton label="Close menu" icon={<X aria-hidden="true" />} data-overlay-close="" />
            </DialogPrimitive.Close>
          </div>
          <nav aria-label="Main" className="min-h-0 overflow-y-auto px-2 py-2">
            {items.length > 0 ? (
              <ul className="grid gap-0.5 border-b border-border pb-2">
                {items.map((item) => {
                  const active = isActive(item, pathname)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(linkClass, active ? 'bg-muted text-text' : 'text-text-secondary hover:bg-muted hover:text-text')}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            <ul className="grid gap-0.5 pt-2">
              {secondary.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setOpen(false)} className={cn(linkClass, 'text-body text-text-secondary hover:bg-muted hover:text-text')}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => startTransition(async () => window.location.assign((await signOut()).redirectTo))}
                  className={cn(linkClass, 'w-full text-left text-body text-text-secondary hover:bg-muted hover:text-text')}
                >
                  Sign out
                </button>
              </li>
            </ul>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
