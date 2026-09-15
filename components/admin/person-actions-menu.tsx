'use client'

import { MoreHorizontal } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu'

import type { PersonMenuItem } from './person-actions'

/** The row-actions dropdown, loaded by ./person-actions.tsx on first hover, focus or click. */
export default function PersonActionsMenu({
  name,
  items,
  defaultOpen,
  onSelect,
}: {
  name: string
  items: PersonMenuItem[]
  defaultOpen: boolean
  onSelect: (label: string) => void
}) {
  return (
    <Menu defaultOpen={defaultOpen}>
      <MenuTrigger asChild>
        <IconButton size="sm" label={`Actions for ${name}`} icon={<MoreHorizontal aria-hidden="true" />} />
      </MenuTrigger>
      <MenuContent>
        {items.map((item) => (
          <MenuItem key={item.label} tone={item.danger ? 'danger' : 'default'} onSelect={() => onSelect(item.label)}>
            {item.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  )
}
