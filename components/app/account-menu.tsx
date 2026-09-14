'use client'

import { ArrowLeftRight, LogOut, Shield, UserRound, Wrench } from 'lucide-react'
import Link from 'next/link'
import { startTransition } from 'react'
import { toast } from 'sonner'

import { signOut } from '@/app/actions/auth'
import { Avatar } from '@/components/ui/identity'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import type { Workspace } from '@/lib/shared/viewer'

type AccountMenuProps = {
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

export function AccountMenu({ name, email, avatarUrl, isAdmin, workspace, appHome, appLabel, devTools }: AccountMenuProps) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="grid size-9 place-items-center rounded-full transition-shadow duration-120 hover:shadow-[0_0_0_4px_var(--color-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent data-[state=open]:shadow-[0_0_0_4px_var(--color-muted)]"
        >
          <Avatar name={name} src={avatarUrl} size="sm" />
        </button>
      </MenuTrigger>
      <MenuContent className="w-64">
        <MenuLabel className="grid gap-0.5 pb-2">
          <span className="truncate text-body font-medium text-text">{name}</span>
          <span className="truncate text-small font-normal text-text-tertiary">{email}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem asChild icon={<UserRound aria-hidden="true" />}>
          <Link href="/account">Account</Link>
        </MenuItem>
        {isAdmin && workspace !== 'admin' ? (
          <MenuItem asChild icon={<Shield aria-hidden="true" />}>
            <Link href="/admin">Switch to admin</Link>
          </MenuItem>
        ) : null}
        {workspace === 'admin' && appHome && appLabel ? (
          <MenuItem asChild icon={<ArrowLeftRight aria-hidden="true" />}>
            <Link href={appHome}>Switch to {appLabel}</Link>
          </MenuItem>
        ) : null}
        {devTools ? (
          <MenuItem asChild icon={<Wrench aria-hidden="true" />}>
            <Link href="/dev">Dev tools</Link>
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem
          icon={<LogOut aria-hidden="true" />}
          onSelect={() => {
            toast.loading('Signing out…', { id: 'sign-out' })
            startTransition(() => signOut())
          }}
        >
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}
