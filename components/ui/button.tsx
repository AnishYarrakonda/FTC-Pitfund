import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/shared/cn'

import { Spinner } from './spinner'

export const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium',
    'transition-[background-color,border-color,color,box-shadow] duration-120 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
    '[&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-white hover:bg-accent-hover active:bg-accent-hover disabled:bg-accent/45 disabled:hover:bg-accent/45 aria-disabled:hover:bg-accent',
        secondary:
          'border border-border-strong bg-surface text-text hover:bg-muted active:bg-muted disabled:text-text-tertiary disabled:hover:bg-surface',
        ghost: 'text-text-secondary hover:bg-muted hover:text-text active:bg-muted disabled:text-text-tertiary disabled:hover:bg-transparent',
        danger:
          'bg-danger text-white hover:bg-danger-hover active:bg-danger-hover disabled:bg-danger/45 disabled:hover:bg-danger/45 aria-disabled:hover:bg-danger',
        link: 'h-auto px-0 text-accent underline-offset-4 hover:text-accent-hover hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-small [&_svg]:size-3.5',
        md: 'h-9 px-4 text-body [&_svg]:size-4',
        lg: 'h-11 px-5 text-lead [&_svg]:size-4',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, swaps the label and blocks clicks without losing focus. */
    loading?: boolean
    loadingLabel?: ReactNode
  }

export function Button({
  className,
  variant,
  size,
  asChild,
  loading = false,
  loadingLabel,
  children,
  type = 'button',
  onClick,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    )
  }
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...props}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  )
}
