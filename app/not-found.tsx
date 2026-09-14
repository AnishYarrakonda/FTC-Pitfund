import Link from 'next/link'

import { Wordmark } from '@/components/app/wordmark'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-app items-center px-4 sm:px-6 lg:px-8">
        <Wordmark />
      </header>
      <main id="main" className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center gap-5 px-4 pb-24 sm:px-6">
        <p className="text-small font-medium text-text-tertiary tabular">404</p>
        <div className="grid gap-2">
          <h1 className="text-h1 font-semibold tracking-tighter text-text">We couldn&apos;t find that page</h1>
          <p className="text-lead text-text-secondary">It may have moved, or you may not have access to it.</p>
        </div>
        <div>
          <Button asChild>
            <Link href="/">Go to FTC Pitfund</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
