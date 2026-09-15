import type { ExternalToast, toast as sonnerToast } from 'sonner'

/*
 * `toast` with Sonner's API, loaded on first use: each call imports Sonner and waits for the
 * mounted <Toaster> (components/ui/toaster.tsx) to render before showing the toast. Keeps Sonner
 * out of every page's first-load JS (plan §6).
 */

type Sonner = typeof sonnerToast
type Message = Parameters<Sonner>[0]

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

async function load(): Promise<Sonner> {
  if (host && !hostReady) hostReady = host()
  const [{ toast }] = await Promise.all([import('sonner'), hostReady])
  return toast
}

const show =
  (kind: 'success' | 'error' | 'warning' | 'info' | 'loading') =>
  (message: Message, options?: ExternalToast): void => {
    void load().then((toast) => toast[kind](message, options))
  }

export const toast = {
  success: show('success'),
  error: show('error'),
  warning: show('warning'),
  info: show('info'),
  loading: show('loading'),
  dismiss: (id?: string | number): void => {
    void load().then((toast) => toast.dismiss(id))
  },
}
