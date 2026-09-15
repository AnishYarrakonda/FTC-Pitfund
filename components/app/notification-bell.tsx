'use client'

import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ComponentProps } from 'react'

import { IconButton } from '@/components/ui/icon-button'
import { useLazyComponent } from '@/lib/client/lazy'

const loadPopover = () => import('./notification-popover')

/**
 * The bell: unread count comes from the viewer query (no polling). The popover (Radix, the list,
 * mark-as-read) loads on first hover, focus or click; opening it loads the latest 20, and marking
 * read is optimistic and rolls back if the server refuses.
 */
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter()
  const [unread, setUnread] = useState(unreadCount)
  const [lastUnreadProp, setLastUnreadProp] = useState(unreadCount)
  const { Component, openOnMount, preload, open } = useLazyComponent(loadPopover)

  // A fresh server count (navigation, router.refresh) replaces the optimistic one.
  if (lastUnreadProp !== unreadCount) {
    setLastUnreadProp(unreadCount)
    setUnread(unreadCount)
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
      onFocus={() => void preload()}
      onClick={open}
    />
  )
}

/** The bell icon button with its unread badge (also the popover's trigger). */
export function BellButton({ unread, ...props }: { unread: number } & Omit<ComponentProps<typeof IconButton>, 'label' | 'icon'>) {
  return (
    <IconButton
      {...props}
      label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
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
