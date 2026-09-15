'use client'

import { Avatar } from '@/components/ui/identity'
import { useLazyComponent } from '@/lib/client/lazy'
import type { Workspace } from '@/lib/shared/viewer'

export type AccountMenuProps = {
  name: string
  email: string
  avatarUrl: string | null
  isAdmin: boolean
  workspace: Workspace | null
  /** Where "back to your workspace" goes from the admin area. */
  appHome: string | null
  appLabel: string | null
  devTools: boolean
}

export const ACCOUNT_TRIGGER_CLASS =
  'grid size-9 place-items-center rounded-full transition-shadow duration-120 hover:shadow-[0_0_0_4px_var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=open]:shadow-[0_0_0_4px_var(--color-muted)]'

const loadMenu = () => import('./account-menu-content')

/** The avatar button. The dropdown (Radix menu) loads on first hover, focus or click. */
export function AccountMenu(props: AccountMenuProps) {
  const { Component, openOnMount, preload, open } = useLazyComponent(loadMenu)
  if (Component) return <Component {...props} defaultOpen={openOnMount} />
  return (
    <button
      type="button"
      aria-label="Account menu"
      aria-haspopup="menu"
      aria-expanded={false}
      className={ACCOUNT_TRIGGER_CLASS}
      onPointerEnter={() => void preload()}
      onFocus={() => void preload()}
      onClick={open}
    >
      <Avatar name={props.name} src={props.avatarUrl} size="sm" />
    </button>
  )
}
