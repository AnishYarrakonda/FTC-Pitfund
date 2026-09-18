import { FormPageSkeleton } from '@/components/app/page-skeletons'

/**
 * The page reads the viewer to know which org is waiting, so it needs a Suspense boundary of its
 * own — a loading.tsx is one (see .claude/rules/architecture.md, cacheComponents).
 */
export default function Loading() {
  return <FormPageSkeleton sections={1} />
}
