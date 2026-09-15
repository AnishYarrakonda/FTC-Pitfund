import 'server-only'

import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { homeFor, type Viewer } from '@/lib/shared/viewer'

import { AppError } from './result'
import { getViewer } from './viewer'

/*
 * Page-side use of lib/server/authz.ts. Guards throw AppError; pages need navigation:
 *   UNAUTHORIZED → /login?next=<this page>
 *   FORBIDDEN    → the viewer's home (wrong workspace) — or notFound() for NOT_FOUND
 */

async function loginRedirect(): Promise<never> {
  const path = (await headers()).get('x-pathname')
  redirect(path && path !== '/' ? `/login?next=${encodeURIComponent(path)}` : '/login')
}

/** The signed-in viewer, or a redirect to /login. */
export async function pageViewer(): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer) return loginRedirect()
  return viewer
}

/** Run a guard for a page and translate its failure into navigation. */
export async function guardPage<T>(guard: () => Promise<T>): Promise<T> {
  try {
    return await guard()
  } catch (e) {
    if (!(e instanceof AppError)) throw e
    if (e.code === 'UNAUTHORIZED') return loginRedirect()
    if (e.code === 'NOT_FOUND') notFound()
    const viewer = await getViewer()
    if (!viewer || viewer.suspendedAt) return loginRedirect()
    const home = homeFor(viewer)
    const path = (await headers()).get('x-pathname') ?? ''
    // Already home and still forbidden (e.g. a suspended team): the layout explains why.
    if (path === home || path.startsWith(`${home}?`)) notFound()
    redirect(home)
  }
}
