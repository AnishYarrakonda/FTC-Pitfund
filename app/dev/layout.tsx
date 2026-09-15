import type { ReactNode } from 'react'

import { Toaster } from '@/components/ui/toaster'

/* This section's actions can toast (useAction). The landing and sign-in pages ship without Sonner. */
export default function ToastLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
