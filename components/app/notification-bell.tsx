'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'

import { fetchNotifications, readAllNotifications, readNotification } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { IconButton } from '@/components/ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { isNetworkError } from '@/lib/client/use-action'
import { cn } from '@/lib/shared/cn'
import { formatRelative } from '@/lib/shared/format'
import { NETWORK_ERROR_MESSAGE } from '@/lib/shared/result'

type Item = { id: string; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date }

/**
 * The bell: unread count comes from the viewer query (no polling). Opening it loads the
 * latest 20; marking read is optimistic and rolls back if the server refuses.
 */
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unread, setUnread] = useState(unreadCount)
  const [loading, startLoading] = useTransition()
  const [lastUnreadProp, setLastUnreadProp] = useState(unreadCount)

  // A fresh server count (navigation, router.refresh) replaces the optimistic one.
  if (lastUnreadProp !== unreadCount) {
    setLastUnreadProp(unreadCount)
    setUnread(unreadCount)
  }

  const load = useCallback(() => {
    setError(null)
    startLoading(async () => {
      try {
        const result = await fetchNotifications({})
        if (result.ok) setItems(result.data)
        else setError(result.error.message)
      } catch (e) {
        setError(isNetworkError(e) ? NETWORK_ERROR_MESSAGE : "Couldn't load notifications.")
      }
    })
  }, [])

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

  const markRead = async (item: Item) => {
    if (item.readAt) return
    setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, readAt: new Date() } : n)) ?? null)
    setUnread((u) => Math.max(0, u - 1))
    try {
      const result = await readNotification({ id: item.id })
      if (!result.ok) throw new Error(result.error.message)
    } catch {
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, readAt: null } : n)) ?? null)
      setUnread((u) => u + 1)
    }
  }

  const markAll = async () => {
    const previous = items
    const previousUnread = unread
    setItems((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })) ?? null)
    setUnread(0)
    try {
      const result = await readAllNotifications({})
      if (!result.ok) throw new Error(result.error.message)
      router.refresh()
    } catch {
      setItems(previous)
      setUnread(previousUnread)
      setError("Couldn't mark notifications as read. Try again.")
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) load()
      }}
    >
      <PopoverTrigger asChild>
        <IconButton
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
      </PopoverTrigger>
      <PopoverContent className="overflow-hidden p-0" aria-label="Notifications">
        <div className="flex h-12 items-center justify-between border-b border-border pr-2 pl-4">
          <h2 className="text-body font-semibold text-text">Notifications</h2>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => void markAll()}>
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-[min(420px,60dvh)] overflow-y-auto" aria-busy={loading || undefined}>
          {error ? (
            <div className="grid justify-items-start gap-2 px-4 py-5">
              <p className="text-body text-text-secondary" role="alert">
                {error}
              </p>
              <Button variant="secondary" size="sm" onClick={load}>
                Retry
              </Button>
            </div>
          ) : items === null ? (
            <div className="grid gap-4 px-4 py-4" aria-label="Loading notifications">
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid gap-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-body font-medium text-text">You&apos;re all caught up</p>
              <p className="mt-1 text-small text-text-tertiary">Updates about your pitches and members show up here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const content = (
                  <>
                    <span
                      aria-hidden="true"
                      className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', item.readAt ? 'bg-transparent' : 'bg-accent')}
                    />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className={cn('line-clamp-2 text-body', item.readAt ? 'text-text-secondary' : 'font-medium text-text')}>
                        {item.title}
                        {!item.readAt ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                      {item.body ? <span className="line-clamp-2 text-small text-text-tertiary">{item.body}</span> : null}
                      <span className="text-caption text-text-tertiary">{formatRelative(item.createdAt)}</span>
                    </span>
                  </>
                )
                const className = 'flex w-full gap-3 px-4 py-3 text-left transition-colors duration-120 hover:bg-canvas'
                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        prefetch={false}
                        className={className}
                        onClick={() => {
                          void markRead(item)
                          setOpen(false)
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button type="button" className={className} onClick={() => void markRead(item)}>
                        {content}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
