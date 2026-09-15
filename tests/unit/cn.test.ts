import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/shared/cn'

/*
 * lib/shared/cn.ts is a small stand-in for tailwind-merge (kept out of client bundles, plan §6).
 * This checks it against tailwind-merge, configured with the app's tokens, on the class strings the
 * app actually uses: every class-like string literal, alone and appended to every class string in
 * the UI primitives (the `cn(base, className)` pattern).
 */

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['caption', 'small', 'body', 'lead', 'h3', 'h2', 'h1', 'display', 'display-lg'],
      radius: ['control', 'menu', 'dialog'],
      shadow: ['sm', 'lg'],
      // Not in the old lib/shared/cn.ts config (so `max-w-full max-w-form` kept both); cn resolves it.
      container: ['auth', 'form', 'reading', 'app', 'review'],
      animate: ['content-in', 'content-out', 'overlay-in', 'overlay-out', 'progress', 'pulse', 'sheet-in', 'sheet-out', 'spin'],
    },
  },
})
const reference = (...inputs: string[]) => twMerge(clsx(inputs))

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

function files(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(join(ROOT, path)).isDirectory()) return files(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

const UTILITY = /^!?([a-z0-9-]+:|\[[^\]]+\]:)*!?-?[a-z][a-z0-9-]*(-\[[^\]\s]+\]|\/[\d.]+|\[[^\]\s]+\])*(-[a-z0-9.]+)*(\/[\d.]+)?!?$/
function classStrings(path: string) {
  const source = readFileSync(join(ROOT, path), 'utf8')
  const out: string[] = []
  for (const m of source.matchAll(/'([^'\n]+)'|"([^"\n]+)"|`([^`$\n]+)`/g)) {
    const text = (m[1] ?? m[2] ?? m[3]).trim()
    const tokens = text.split(/\s+/)
    // Class lists: every token looks like a utility and at least one has a dash or a variant.
    if (tokens.every((t) => UTILITY.test(t)) && tokens.some((t) => t.includes('-') || t.includes(':'))) out.push(text)
  }
  return out
}

// cn.ts itself is excluded: its group names look like classes.
const corpus = [...new Set(['app', 'components', 'lib'].flatMap(files).filter((f) => f !== 'lib/shared/cn.ts').flatMap(classStrings))]
const bases = [...new Set(files('components/ui').concat(files('components/app')).flatMap(classStrings))]

describe('cn matches tailwind-merge on the app’s classes', () => {
  it('found a realistic corpus', () => {
    expect(corpus.length).toBeGreaterThan(400)
    expect(bases.length).toBeGreaterThan(80)
  })

  it('merges every class string on its own the same way', () => {
    const diffs = corpus.filter((s) => cn(s) !== reference(s)).map((s) => `${s}\n  cn:  ${cn(s)}\n  ref: ${reference(s)}`)
    expect(diffs.slice(0, 20)).toEqual([])
  })

  it('merges every class string appended to each primitive’s classes the same way', () => {
    const diffs: string[] = []
    for (const base of bases) {
      for (const extra of corpus) {
        const ours = cn(base, extra)
        const theirs = reference(base, extra)
        if (ours !== theirs) diffs.push(`${base} + ${extra}\n  cn:  ${ours}\n  ref: ${theirs}`)
        if (diffs.length >= 20) break
      }
      if (diffs.length >= 20) break
    }
    expect(diffs).toEqual([])
  })

  it('handles the overrides the components rely on', () => {
    expect(cn('px-3 text-body text-text', 'px-5 text-small text-text-secondary')).toBe('px-5 text-small text-text-secondary')
    expect(cn('h-9 px-4', 'h-11 px-5')).toBe('h-11 px-5')
    expect(cn('border border-border', 'border-danger')).toBe('border border-danger')
    expect(cn('rounded-control', 'rounded-full')).toBe('rounded-full')
    expect(cn('hover:bg-muted', 'hover:bg-danger-subtle bg-surface')).toBe('hover:bg-danger-subtle bg-surface')
    expect(cn('p-4', 'px-2')).toBe('p-4 px-2')
    expect(cn('px-2', 'p-4')).toBe('p-4')
  })
})
