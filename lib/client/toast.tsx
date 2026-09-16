/*
 * `toast`, loaded on first use: each call imports Sonner and waits for the mounted <Toaster>
 * (components/ui/toaster.tsx) to render before showing anything. Keeps Sonner out of every page's
 * first-load JS (plan §6).
 *
 * Every toast is rendered by our own <ToastContent>: a dismiss button and a bar that drains for
 * exactly as long as the toast will live, so nothing disappears without having said how long it
 * had, and nothing sits on screen forever waiting to be noticed.
 */

export type ToastOptions = {
  description?: string
  /** One button, for the thing you'd otherwise have to go and find (Undo, Retry). */
  action?: { label: string; onClick: () => void }
  /** Dedupes: showing the same id again replaces the toast instead of stacking another. */
  id?: string | number
  duration?: number
}

let host: (() => Promise<void>) | null = null
let hostReady: Promise<void> | null = null

/** Called by <Toaster> on mount; returns the unregister function. */
export function registerToasterHost(load: () => Promise<void>) {
  host = load
  hostReady = null
  return () => {
    if (host === load) {
      host = null
      hostReady = null
    }
  }
}

async function load() {
  if (host && !hostReady) hostReady = host()
  const [{ toast }, { ToastContent }] = await Promise.all([import('sonner'), import('@/components/ui/toast-content'), hostReady])
  return { toast, ToastContent }
}

/** Long enough to read a sentence. Errors get longer because they usually need acting on. */
const DEFAULT_MS = 6000
const ERROR_MS = 10_000

const show =
  (kind: 'success' | 'error' | 'warning' | 'info' | 'loading') =>
  (message: string, options?: ToastOptions): void => {
    const duration = options?.duration ?? (kind === 'loading' ? Infinity : kind === 'error' ? ERROR_MS : DEFAULT_MS)
    void load().then(({ toast, ToastContent }) => {
      toast.custom(
        (id) => (
          <ToastContent
            kind={kind}
            title={message}
            description={options?.description}
            action={options?.action}
            durationMs={duration}
            onDismiss={() => toast.dismiss(id)}
          />
        ),
        { id: options?.id, duration },
      )
    })
  }

export const toast = {
  success: show('success'),
  error: show('error'),
  warning: show('warning'),
  info: show('info'),
  /** Stays until something replaces or dismisses it: the thing it reports is still happening. */
  loading: show('loading'),
  dismiss: (id?: string | number): void => {
    void load().then(({ toast }) => toast.dismiss(id))
  },
}
