'use client'

import { ArrowLeftRight, LogOut, Shield, UserRound, Wrench } from 'lucide-react'
import Link from 'next/link'
import { startTransition } from 'react'

import { signOut } from '@/app/actions/auth'
import { Avatar } from '@/components/ui/avatar'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { toast } from '@/lib/client/toast'

import { ACCOUNT_TRIGGER_CLASS, type AccountMenuProps } from './account-menu'

/** The account dropdown itself, loaded by ./account-menu.tsx on first hover, focus or click. */
export default function AccountMenuContent({ name, email, avatarUrl, isAdmin, workspace, appHome, appLabel, devTools, defaultOpen }: AccountMenuProps & { defaultOpen: boolean }) {
  return (
    <Menu defaultOpen={defaultOpen}>
      <MenuTrigger asChild>
        <button type="button" aria-label="Account menu" className={ACCOUNT_TRIGGER_CLASS}>
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
