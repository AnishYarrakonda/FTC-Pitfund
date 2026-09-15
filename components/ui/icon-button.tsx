import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

type IconButtonProps = Omit<ComponentProps<'button'>, 'aria-label' | 'children'> & {
  /** Required: icon-only controls must have an accessible name. */
  label: string
  icon: ReactNode
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'secondary'
}

export function IconButton({ label, icon, size = 'md', variant = 'ghost', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-control transition-[background-color,color] duration-120',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0',
        size === 'sm' ? 'size-8 [&_svg]:size-4' : 'size-9 [&_svg]:size-[18px]',
        variant === 'secondary'
          ? 'border border-border-strong bg-surface text-text-secondary hover:bg-muted hover:text-text'
          : 'text-text-secondary hover:bg-muted hover:text-text data-[state=open]:bg-muted data-[state=open]:text-text',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}
