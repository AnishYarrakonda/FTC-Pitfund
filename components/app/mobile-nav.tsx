'use client'

import { Menu as MenuIcon } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import { useLazyComponent } from '@/lib/client/lazy'
import type { NavItem } from '@/lib/shared/nav'

export type MobileNavProps = {
  items: NavItem[]
  secondary: Array<{ href: string; label: string }>
  name: string
  email: string
}

const loadSheet = () => import('./mobile-nav-sheet')

/** Below 640 px the nav collapses into a bottom-anchored menu sheet (plan §7), loaded on first use. */
export function MobileNav(props: MobileNavProps) {
  const { Component, openOnMount, preload, open } = useLazyComponent(loadSheet)
  if (Component) return <Component {...props} defaultOpen={openOnMount} />
  return (
    <IconButton
      label="Open menu"
      icon={<MenuIcon aria-hidden="true" />}
      className="sm:hidden"
      aria-haspopup="dialog"
      aria-expanded={false}
      onPointerDown={() => void preload()}
      onFocus={(e) => void preload(e.currentTarget)}
      onClick={open}
    />
  )
}
