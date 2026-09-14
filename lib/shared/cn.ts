import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * tailwind-merge must know the custom type scale, or it treats `text-small` (a size) and
 * `text-text-secondary` (a color) as the same group and drops one of them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['caption', 'small', 'body', 'lead', 'h3', 'h2', 'h1', 'display', 'display-lg'],
      radius: ['control', 'menu', 'dialog'],
      shadow: ['sm', 'lg'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
