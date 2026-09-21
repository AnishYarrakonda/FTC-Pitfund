'use client'

import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ComponentProps } from 'react'

import { IconButton } from '@/components/ui/icon-button'
import { useLazyComponent } from '@/lib/client/lazy'

const loadPopover = () => import('./notification-popover')

/**
 * The bell is a to-do list, not a feed: it holds only the things this person still has to act on,
 * and each one clears itself when the thing is handled (lib/shared/notifications.ts). Everything
 * else is told as a toast at the moment it happens. The count comes from the viewer query, so
 * there is no polling; the popover loads on first hover, focus or click.
 */
export function NotificationBell({ actionCount }: { actionCount: number }) {
  const router = useRouter()
  const [unread, setUnread] = useState(actionCount)
  const [lastCountProp, setLastCountProp] = useState(actionCount)
  const { Component, openOnMount, preload, open } = useLazyComponent(loadPopover)

  // A fresh server count (navigation, router.refresh) replaces the optimistic one.
  if (lastCountProp !== actionCount) {
    setLastCountProp(actionCount)
    setUnread(actionCount)
  }

  // Refresh the server-rendered count when the tab regains focus (throttled).
  useEffect(() => {
    let last = Date.now()
    const onFocus = () => {
      if (Date.now() - last < 30_000) return
      last = Date.now()
      router.refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [router])

  if (Component) return <Component unread={unread} setUnread={setUnread} defaultOpen={openOnMount} />
  return (
    <BellButton
      unread={unread}
      aria-haspopup="dialog"
      aria-expanded={false}
      onPointerEnter={() => void preload()}
      onFocus={(e) => void preload(e.currentTarget)}
      onClick={open}
    />
  )
}

/** The bell icon button with its unread badge (also the popover's trigger). */
export function BellButton({ unread, ...props }: { unread: number } & Omit<ComponentProps<typeof IconButton>, 'label' | 'icon'>) {
  return (
    <IconButton
      {...props}
      label={unread > 0 ? `Needs your attention, ${unread} ${unread === 1 ? 'item' : 'items'}` : 'Needs your attention'}
      icon={
        <span className="relative">
          <Bell aria-hidden="true" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-2 inline-grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-surface tabular"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </span>
      }
    />
  )
}
