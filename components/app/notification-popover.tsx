'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, useTransition, type Dispatch, type SetStateAction } from 'react'

import { fetchNotifications, readNotification } from '@/app/actions/account'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu'
import { isNetworkError } from '@/lib/client/use-action'
import { cn } from '@/lib/shared/cn'
import { formatRelative } from '@/lib/shared/format'
import { NETWORK_ERROR_MESSAGE } from '@/lib/shared/result'

import { BellButton } from './notification-bell'

type Item = { id: string; title: string; body: string | null; href: string | null; readAt: Date | null; createdAt: Date }

/** The notifications popover, loaded by ./notification-bell.tsx on first hover, focus or click. */
export default function NotificationPopover({
  unread,
  setUnread,
  defaultOpen,
}: {
  unread: number
  setUnread: Dispatch<SetStateAction<number>>
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, startLoading] = useTransition()

  const load = useCallback(() => {
    startLoading(async () => {
      setError(null)
      try {
        const result = await fetchNotifications({})
        if (result.ok) setItems(result.data)
        else setError(result.error.message)
      } catch (e) {
        setError(isNetworkError(e) ? NETWORK_ERROR_MESSAGE : "Couldn't load notifications.")
      }
    })
  }, [])

  // Opened by the click that loaded this module: fetch the list right away.
  useEffect(() => {
    if (defaultOpen) load()
  }, [defaultOpen, load])

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

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) load()
      }}
    >
      <PopoverTrigger asChild>
        <BellButton unread={unread} />
      </PopoverTrigger>
      <PopoverContent className="overflow-hidden p-0" aria-label="Needs your attention">
        {/*
          No "Mark all read": these are things to do, and the way to clear one is to do it. The
          server clears them itself when the underlying thing is handled, by anyone on the org.
        */}
        <div className="flex h-12 items-center border-b border-border px-4">
          <h2 className="text-body font-semibold text-text">Needs your attention</h2>
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
            <div className="grid gap-4 px-4 py-4" aria-label="Loading">
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
              <p className="mt-1 text-small text-text-tertiary">Anything waiting on you shows up here.</p>
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
