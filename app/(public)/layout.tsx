import type { Viewport } from 'next'
import type { ReactNode } from 'react'

/*
 * Every public page (landing, sign-in, legal, team pages, invites) renders in the light system. The class
 * redefines the design tokens (app/globals.css, `.theme-light`), so shared components need no changes.
 * The signed-in app and admin stay dark until phase 2 of the redesign moves the whole site over.
 */

export const viewport: Viewport = { themeColor: '#ffffff' }

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <div className="theme-light">{children}</div>
}
