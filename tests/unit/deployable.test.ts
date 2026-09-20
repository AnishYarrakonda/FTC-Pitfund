import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/*
 * Vercel builds from an upload that .vercelignore has already stripped, so `next build` type-checks a
 * tree that is missing /tests, /docs, /prompts and /qa. Nothing else reproduces that: a local build and
 * CI both have those directories on disk. Every preview deployment errored for days on TS2307 because
 * five scripts and both Playwright configs import `../tests/...` and were still in the root set.
 *
 * tsconfig.build.json (what `next build` uses) drops those directories, and this keeps the two files
 * honest: everything .vercelignore strips is excluded from the build, and nothing the build still
 * type-checks reaches into a directory that will not be there.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Top-level directories .vercelignore keeps out of the upload (`/tests/`, `/docs/`, …). */
const stripped = read('.vercelignore')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /^\/[\w.-]+\/$/.test(line))
  .map((line) => line.slice(1, -1))

const buildConfig = JSON.parse(read('tsconfig.build.json')) as { exclude: string[] }
const excluded = new Set(buildConfig.exclude)

/** Every TypeScript file `next build` still puts in its root set. */
function rootSet(dir = ''): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = dir ? `${dir}/${name}` : name
    if (name.startsWith('.') || name === 'node_modules' || excluded.has(path)) return []
    if (statSync(join(ROOT, path)).isDirectory()) return rootSet(path)
    return /\.(tsx?|mts)$/.test(name) ? [path] : []
  })
}

/** Specifiers of every static and dynamic import in a file, resolved to a repo-relative path. */
function importsOf(path: string): string[] {
  const source = read(path)
  const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')
  return specifiers.flatMap((specifier) => {
    if (specifier.startsWith('@/')) return [specifier.slice(2)]
    if (!specifier.startsWith('.')) return []
    return [relative(ROOT, resolve(ROOT, dirname(path), specifier)).split(sep).join('/')]
  })
}

describe('what Vercel actually builds', () => {
  it('strips directories in .vercelignore that the build tsconfig also excludes', () => {
    expect(stripped).toContain('tests')
    for (const dir of stripped) expect(excluded, `.vercelignore strips /${dir}/`).toContain(dir)
  })

  it('never type-checks a file that imports something .vercelignore left behind', () => {
    const reaching = rootSet().flatMap((path) =>
      importsOf(path)
        .filter((target) => stripped.includes(target.split('/')[0] ?? ''))
        .map((target) => `${path} → ${target}`),
    )
    expect(reaching).toEqual([])
  })
})
