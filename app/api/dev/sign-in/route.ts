import { connection, NextResponse } from 'next/server'

import { assertDevTools, signInAsPersona } from '@/lib/server/dev'
import { devToolsEnabled } from '@/lib/server/env'
import { loadViewer } from '@/lib/server/viewer'
import { isPersonaKey } from '@/lib/shared/personas'
import { requestOrigin } from '@/lib/shared/request-origin'
import { safeNext } from '@/lib/shared/sign-in'
import { homeFor } from '@/lib/shared/viewer'

/*
 * Local only: GET /api/dev/sign-in?persona=coach[&next=/pitches]
 * Signs in as a seeded persona and redirects. Playwright uses it to produce storageState
 * fixtures without driving the login UI.
 */
export async function GET(request: Request) {
  if (!devToolsEnabled()) return new Response('Not found', { status: 404 })
  assertDevTools()

  const url = new URL(request.url)
  const persona = url.searchParams.get('persona') ?? ''
  if (!isPersonaKey(persona)) return Response.json({ error: 'Unknown persona' }, { status: 400 })

  await connection()
  try {
    const user = await signInAsPersona(persona)
    const viewer = user ? await loadViewer(user.id) : null
    const destination = safeNext(url.searchParams.get('next')) ?? (viewer ? homeFor(viewer) : '/welcome')
    return NextResponse.redirect(new URL(destination, requestOrigin(request)), 303)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Sign-in failed' }, { status: 500 })
  }
}
