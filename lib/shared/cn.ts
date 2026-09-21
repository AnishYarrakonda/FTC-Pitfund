import { clsx, type ClassValue } from 'clsx'

/*
 * Join class names and let later Tailwind utilities override earlier ones that set the same thing
 * (`cn('px-3 text-body', className)` with `px-5` keeps only `px-5`). A small, product-specific
 * version of tailwind-merge: it ships in almost every client bundle, and tailwind-merge's full
 * class map costs ~9 KB gzipped (plan §6 budget). It knows this app's tokens (text sizes vs text
 * colors, radii, shadows, container widths, animations). tests/unit/cn.test.ts checks it against
 * tailwind-merge on every class string in the codebase; add a rule when that test finds a difference.
 */

const SIZE = '(\\d+(\\.\\d+)?|px|full|auto|screen|fit|min|max|[dsl]vh|dvw|\\[.+\\]|auth|form|reading|app|review|[23]?xs|sm|md|lg|x{0,2}l|prose|none)'

/**
 * Utility → conflict group, first match wins (a leading `-` is removed first). `$1`/`$2` insert
 * the match; an empty group means "never conflicts".
 */
const RULES: Array<[RegExp, string]> = [
  [/^(block|inline(-block|-flex|-grid)?|flex|grid|contents|hidden|table|flow-root|list-item)$/, 'display'],
  [/^(static|fixed|absolute|relative|sticky)$/, 'position'],
  [/^(visible|invisible|collapse)$/, 'visibility'],
  [/^(not-)?sr-only$/, 'sr'],
  [/^(truncate|text-ellipsis|text-clip)$/, 'text-overflow'],
  [/^(underline|overline|line-through|no-underline)$/, 'text-decoration'],
  [/^(uppercase|lowercase|capitalize|normal-case)$/, 'text-transform'],
  [/^(grow|shrink)(-|$)/, '$1'],
  // Gradient color stops (`from-brand-blue to-brand-yellow`, the signature gradient).
  [/^(from|via|to)-/, 'gradient-$1'],
  [/^border(-\d|-\[|$)/, 'border-w'],
  [/^rounded(-(none|full|sm|md|lg|xl|2xl|3xl|control|menu|dialog|\[)|$)/, 'rounded'],
  [/^(shadow|transition)(-|$)/, '$1'],
  [/^ring(-\d|-\[|$)/, 'ring-w'],
  [/^outline-(none|dashed|dotted|double)/, 'outline-style'],
  [/^outline(-\d|$)/, 'outline-w'],
  [/^line-clamp-/, 'line-clamp'],
  [/^text-(caption|small|body|lead|h[123]|display(-lg)?|xs|sm|base|lg|[23]?xl)$/, 'font-size'],
  [/^text-\[(\d|calc|min\(|max\(|clamp|var\(--(?!color))/, 'font-size'],
  [/^text-(left|center|right|justify|start|end)$/, 'text-align'],
  [/^text-(wrap|nowrap|balance|pretty)$/, 'text-wrap'],
  [/^text-/, 'text-color'],
  [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, 'font-weight'],
  [/^font-/, 'font-family'],
  [/^bg-(cover|contain|auto|center|top|bottom|left|right|no|repeat|fixed|local|scroll|clip|origin|none|linear|radial)(-|$)/, 'bg-$1'],
  [/^bg-/, 'bg-color'],
  [/^border-([trblsexy])(-\d|-\[|$)/, 'border-w-$1'],
  [/^border-(solid|dashed|dotted|double|hidden|none)$/, 'border-style'],
  [/^border-(collapse|separate)$/, 'border-collapse'],
  [/^border-([trblsexy])-/, 'border-color-$1'],
  [/^border-/, 'border-color'],
  [/^rounded-([a-z]+)/, 'rounded-$1'],
  [/^ring-offset-(\d|\[)/, 'ring-offset-w'],
  [/^ring-offset-/, 'ring-offset-color'],
  [/^ring-/, 'ring-color'],
  [/^outline-offset-/, 'outline-offset'],
  [/^outline-/, 'outline-color'],
  [/^decoration-(\d|\[|auto|from-font)/, 'decoration-thickness'],
  [/^decoration-/, 'decoration-color'],
  [/^underline-/, 'underline-offset'],
  [/^flex-(row|col)(-reverse)?$/, 'flex-direction'],
  [/^flex-(wrap(-reverse)?|nowrap)$/, 'flex-wrap'],
  // Only the real shorthand values take the `flex` group. A bare /^flex-/ catch-all also swallowed
  // things that aren't Tailwind utilities at all (an inline style's 'flex-start' reaches this
  // through cn's own callers), and because `flex` overrides grow/shrink/basis that silently
  // dropped a `shrink-0`. tailwind-merge leaves an unrecognised flex-* alone; so do we.
  [/^flex-(\d+(\.\d+)?(\/\d+)?|auto|initial|none|\[)/, 'flex'],
  [/^flex-/, ''],
  [/^grid-(cols|rows|flow)-/, 'grid-$1'],
  [/^grid-/, ''],
  [/^(col|row)-([a-z]+)/, '$1-$2'],
  [/^table-(auto|fixed)$/, 'table-layout'],
  [/^table-/, ''],
  [/^content-(normal|center|start|end|between|around|evenly|baseline|stretch|none|\[)/, 'content'],
  [/^content-/, ''],
  // object-fit and object-position are different properties: `object-cover object-top` keeps both.
  [/^object-(contain|cover|fill|none|scale-down)$/, 'object-fit'],
  [/^object-/, 'object-position'],
  [/^(items|self|order|z|opacity|basis|cursor|select|leading|tracking|whitespace|break|duration|ease|delay|animate|aspect|fill|stroke|list|align|origin|appearance|resize|scroll|snap|touch|will|size|isolation|mix|caret|accent|rotate)-/, '$1'],
  [/^pointer-/, 'pointer-events'],
  [/^justify-(items|self)-/, 'justify-$1'],
  [/^justify-/, 'justify-content'],
  [/^place-([a-z]+)/, 'place-$1'],
  [/^(overflow|gap|inset|translate|scale)-([xy])-/, '$1-$2'],
  [/^(overflow|gap|translate|scale)-/, '$1'],
  [/^space-(x|y)-/, 'space-$1'],
  [/^divide-(x|y)/, 'divide-$1'],
  [/^divide-/, 'divide-color'],
  [new RegExp(`^(inset|top|right|bottom|left|start|end|w|h)-${SIZE}$`), '$1'],
  [/^(inset|top|right|bottom|left|start|end|w|h)-/, ''],
  [new RegExp(`^(min|max)-([wh])-${SIZE}$`), '$1-$2'],
  [/^([pm][xytrblse]?)-/, '$1'],
]

function groupOf(utility: string) {
  const u = utility.replace(/^-/, '')
  for (const [re, group] of RULES) {
    const m = u.match(re)
    if (m) return group.replace(/\$(\d)/g, (_, i: string) => m[Number(i)])
  }
  return ''
}

const SIDES = 'trblsexy'
/** Groups that a later class of this group also overrides. */
const OVERRIDES: Record<string, string[]> = {
  p: ['px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe'],
  px: ['pr', 'pl', 'ps', 'pe'],
  py: ['pt', 'pb'],
  m: ['mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me'],
  mx: ['mr', 'ml', 'ms', 'me'],
  my: ['mt', 'mb'],
  size: ['w', 'h'],
  gap: ['gap-x', 'gap-y'],
  inset: ['inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end'],
  'inset-x': ['right', 'left'],
  'inset-y': ['top', 'bottom'],
  overflow: ['overflow-x', 'overflow-y'],
  'border-w': [...SIDES].map((s) => `border-w-${s}`),
  'border-w-x': ['border-w-r', 'border-w-l'],
  'border-w-y': ['border-w-t', 'border-w-b'],
  'border-color': [...SIDES].map((s) => `border-color-${s}`),
  rounded: ['t', 'r', 'b', 'l', 's', 'e', 'tl', 'tr', 'br', 'bl'].map((s) => `rounded-${s}`),
  'rounded-t': ['rounded-tl', 'rounded-tr'],
  'rounded-b': ['rounded-bl', 'rounded-br'],
  'rounded-l': ['rounded-tl', 'rounded-bl'],
  'rounded-r': ['rounded-tr', 'rounded-br'],
  flex: ['grow', 'shrink', 'basis'],
  'font-size': ['leading'],
  // line-clamp sets display and overflow too.
  'line-clamp': ['display', 'overflow'],
}

function merge(classes: string) {
  const list = classes.split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  const kept: string[] = []
  for (let i = list.length - 1; i >= 0; i--) {
    const cls = list[i]
    // `hover:[&>svg]:!px-2`: variants (brackets may hold colons), an optional !, then the utility.
    const [, variants = '', bang = '', rest = cls] = cls.match(/^((?:\[[^\]]*\]:|[^:[]+:)*)(!?)(.*)$/) ?? []
    const important = bang || (rest.endsWith('!') ? '!' : '')
    const utility = rest.replace(/!$/, '')
    // Opacity modifiers (`bg-accent/45`) don't change what a class sets.
    const group = groupOf(utility.includes('[') ? utility : utility.replace(/\/.*$/, ''))
    if (group) {
      const prefix = variants + important
      if (seen.has(prefix + group)) continue
      seen.add(prefix + group)
      for (const g of OVERRIDES[group] ?? []) seen.add(prefix + g)
    }
    kept.push(cls)
  }
  return kept.reverse().join(' ')
}

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}
