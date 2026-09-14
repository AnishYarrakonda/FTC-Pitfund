import { PageHeaderSkeleton, Skeleton, SkeletonList } from '@/components/ui/feedback'
import { PageContainer } from '@/components/ui/page'

/* Segment loading states. Each mirrors the page it stands in for, so nothing shifts. */

export function ListPageSkeleton({ action = true }: { action?: boolean }) {
  return (
    <PageContainer>
      <div role="status" aria-label="Loading">
        <PageHeaderSkeleton action={action} />
        <SkeletonList rows={6} />
      </div>
    </PageContainer>
  )
}

export function PlaceholderPageSkeleton() {
  return (
    <PageContainer>
      <div role="status" aria-label="Loading">
        <PageHeaderSkeleton action={false} />
        <div className="grid justify-items-center gap-3 rounded-dialog border border-border bg-surface px-6 py-20">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="mt-3 h-9 w-36" />
        </div>
      </div>
    </PageContainer>
  )
}

export function FormPageSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <PageContainer width="form">
      <div role="status" aria-label="Loading">
        <PageHeaderSkeleton action={false} />
        {Array.from({ length: sections }, (_, i) => (
          <div key={i} className="grid gap-5 border-t border-border py-8 first:border-t-0 first:pt-0">
            <div className="grid gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  )
}

export function DirectoryPageSkeleton() {
  return (
    <PageContainer>
      <div role="status" aria-label="Loading">
        <PageHeaderSkeleton action={false} />
        <div className="grid gap-3 pb-5">
          <Skeleton className="h-9 w-full sm:max-w-sm" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-20" />
            ))}
          </div>
        </div>
        <SkeletonList rows={6} className="rounded-dialog" />
      </div>
    </PageContainer>
  )
}

export function PitchesPageSkeleton() {
  return (
    <PageContainer>
      <div role="status" aria-label="Loading">
        <PageHeaderSkeleton />
        <div className="grid gap-3">
          <Skeleton className="h-4 w-40" />
          <SkeletonList rows={5} className="rounded-dialog" />
        </div>
      </div>
    </PageContainer>
  )
}

export function TeamPageSkeleton() {
  return (
    <PageContainer>
      <div role="status" aria-label="Loading">
        <PageHeaderSkeleton />
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
          <div className="grid content-start gap-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-dialog" />
              <Skeleton className="h-8 w-32" />
            </div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="hidden h-96 rounded-dialog lg:block" />
        </div>
      </div>
    </PageContainer>
  )
}

export function DetailPageSkeleton({ width = 'reading', aside = false }: { width?: 'reading' | 'review'; aside?: boolean }) {
  return (
    <PageContainer width={width}>
      <div role="status" aria-label="Loading">
        <Skeleton className="h-4 w-20" />
        <div className="mt-6 flex items-center gap-4">
          <Skeleton className="size-16 rounded-dialog" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="hidden h-9 w-32 sm:block" />
        </div>
        <div className={aside ? 'mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]' : 'mt-10 grid gap-8'}>
          <div className="grid content-start gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
          {aside ? <Skeleton className="hidden h-72 lg:block" /> : null}
        </div>
      </div>
    </PageContainer>
  )
}
