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
