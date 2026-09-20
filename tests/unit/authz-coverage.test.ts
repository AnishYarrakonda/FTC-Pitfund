import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/*
 * Static authz coverage (prompt 4, section E). Every exported server action ('use server' module
 * exports, including `defineAction(...)` handlers) and every route handler (`app/**\/route.ts`
 * GET/POST/…) must either
 *   - call a guard from lib/server/authz.ts unconditionally, awaited, before any other call, or
 *   - be on PUBLIC below with a reason and the check it performs instead, which this test also
 *     verifies is present in the handler.
 * A new action or handler without either fails here. No database: this only parses source.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const AUTHZ_MODULE = '@/lib/server/authz'
const HTTP_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

type RequiredCall = { name: string; from: string }
type PublicEntry = {
  reason: string
  /** Calls (by imported name and module) that must happen unconditionally in the handler. */
  calls?: RequiredCall[]
  /** Source patterns (comments stripped, whitespace collapsed) that must appear in the handler. */
  patterns?: RegExp[]
}

const BOT_ID: PublicEntry = {
  reason: 'Open to signed-out visitors; Vercel BotID rejects automated requests.',
  calls: [{ name: 'checkBotId', from: 'botid/server' }],
  patterns: [/if \(verification\.isBot\)/],
}
const DEV_ONLY: PublicEntry = {
  reason: 'Local /dev tooling; assertDevTools() 404s unless dev server on the local Supabase stack.',
  calls: [{ name: 'assertDevTools', from: '@/lib/server/dev' }],
}
const CRON_BEARER: PublicEntry = {
  reason: 'Called by Vercel Cron / scripts, not people; requires Bearer CRON_SECRET and fails closed when unset.',
  patterns: [/const secret = env\(\)\.CRON_SECRET/, /if \(!secret \|\| request\.headers\.get\('authorization'\) !== `Bearer \$\{secret\}`\)/],
}
const OWN_SESSION_SIGN_OUT: PublicEntry = {
  reason: "Signs the caller out of their own session only (cookie-bound client); there is no one else's data to reach.",
  calls: [{ name: 'createSupabaseServerClient', from: '@/lib/server/supabase' }],
  patterns: [/\.auth\.signOut\(\{ scope: 'local' \}\)/],
}

const PUBLIC: Record<string, PublicEntry> = {
  'app/actions/auth.ts#requestLoginCode': BOT_ID,
  'app/actions/auth.ts#verifyLoginCode': {
    reason: 'Second sign-in step; Supabase Auth verifies (and rate-limits) the emailed 6-digit code.',
    calls: [{ name: 'createSupabaseServerClient', from: '@/lib/server/supabase' }],
    patterns: [/\.auth\.verifyOtp\(\{ email, token: code, type: 'email' \}\)/, /if \(error \|\| !data\.user\)/],
  },
  'app/actions/auth.ts#signOut': OWN_SESSION_SIGN_OUT,
  'app/actions/auth.ts#signOutForInvite': OWN_SESSION_SIGN_OUT,
  'app/actions/reports.ts#reportTeamPage': BOT_ID,
  'app/actions/dev.ts#switchPersona': DEV_ONLY,
  'app/actions/dev.ts#resetData': DEV_ONLY,
  'app/actions/dev.ts#fakeSlowSuccess': DEV_ONLY,
  'app/actions/dev.ts#fakeSlowFailure': DEV_ONLY,
  'app/actions/dev.ts#fakeUnexpectedFailure': DEV_ONLY,
  'app/actions/dev.ts#fakeFieldFailure': DEV_ONLY,

  'app/api/auth/send-email/route.ts#POST': {
    reason: 'Supabase Auth Send Email hook; the Standard Webhooks signature is verified with SEND_EMAIL_HOOK_SECRET.',
    calls: [{ name: 'verifyWebhook', from: '@/lib/server/webhooks' }],
    patterns: [/verifyWebhook<HookPayload>\(env\(\)\.SEND_EMAIL_HOOK_SECRET, body, request\.headers\)/, /return hookError\(401, 'Invalid signature'\)/],
  },
  'app/api/webhooks/resend/route.ts#POST': {
    reason: 'Resend delivery webhook; the Svix signature is verified with RESEND_WEBHOOK_SECRET.',
    calls: [{ name: 'verifyWebhook', from: '@/lib/server/webhooks' }],
    patterns: [/verifyWebhook<ResendEvent>\(env\(\)\.RESEND_WEBHOOK_SECRET, body, request\.headers\)/, /if \(!event\) return Response\.json\(\{ error: 'Invalid signature' \}, \{ status: 401 \}\)/],
  },
  'app/api/cron/daily/route.ts#GET': CRON_BEARER,
  'app/api/revalidate/route.ts#POST': CRON_BEARER,
  'app/api/health/route.ts#GET': {
    reason: 'Uptime probe; answers only up/down and the database latency.',
    calls: [{ name: 'checkDatabase', from: '@/lib/server/jobs' }],
    patterns: [/\{ ok: db\.ok, db: db\.ok \? 'up' : 'down', latencyMs: db\.latencyMs \}/],
  },
  'app/api/dev/sign-in/route.ts#GET': {
    reason: 'Playwright persona sign-in; 404 unless devToolsEnabled() (dev server on the local Supabase stack).',
    calls: [
      { name: 'devToolsEnabled', from: '@/lib/server/env' },
      { name: 'assertDevTools', from: '@/lib/server/dev' },
    ],
    patterns: [/if \(!devToolsEnabled\(\)\) return new Response\('Not found', \{ status: 404 \}\)/],
  },
}

// ─── Source analysis ────────────────────────────────────────────────────────────────────

type FunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration

type Entry = { id: string; kind: 'action' | 'route'; fn: FunctionLike | null; problem?: string; module: Module }

type Module = {
  file: string
  sf: ts.SourceFile
  /** local name → { imported name, module specifier } */
  imports: Map<string, { name: string; from: string }>
  /** top-level function declarations and `const x = () => {}` in this file */
  locals: Map<string, FunctionLike>
}

const isFunctionLike = (n: ts.Node): n is FunctionLike =>
  ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)

function hasUseServer(statements: readonly ts.Statement[]) {
  for (const s of statements) {
    if (!ts.isExpressionStatement(s) || !ts.isStringLiteral(s.expression)) return false
    if (s.expression.text === 'use server') return true
  }
  return false
}

function parseModule(file: string, source: string): Module {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const imports = new Map<string, { name: string; from: string }>()
  const locals = new Map<string, FunctionLike>()
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings)) {
      for (const el of s.importClause.namedBindings.elements) {
        imports.set(el.name.text, { name: (el.propertyName ?? el.name).text, from: s.moduleSpecifier.text })
      }
    }
    if (ts.isFunctionDeclaration(s) && s.name) locals.set(s.name.text, s)
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          locals.set(d.name.text, d.initializer)
        }
      }
    }
  }
  return { file, sf, imports, locals }
}

const isExported = (n: ts.Node) =>
  ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/** The function an exported initializer runs: a function, `defineAction(schema, handler[, options])`, or a local reference. */
function resolveHandler(mod: Module, expr: ts.Expression | undefined): { fn: FunctionLike | null; problem?: string } {
  if (!expr) return { fn: null, problem: 'export has no initializer' }
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) return { fn: expr }
  if (ts.isIdentifier(expr)) {
    const local = mod.locals.get(expr.text)
    return local ? { fn: local } : { fn: null, problem: `export refers to "${expr.text}", which isn't a function in this file` }
  }
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const imported = mod.imports.get(expr.expression.text)
    if (imported?.name === 'defineAction' && imported.from === '@/lib/server/result') {
      // defineAction(schema, handler) or defineAction(schema, handler, { conflict }).
      return resolveHandler(mod, expr.arguments[1])
    }
  }
  return { fn: null, problem: `unrecognised export shape: ${expr.getText(mod.sf).slice(0, 60)}` }
}

function collectEntries(file: string, source: string, kind: 'action' | 'route'): Entry[] {
  const mod = parseModule(file, source)
  const entries: Entry[] = []
  const add = (name: string, fn: FunctionLike | null, problem?: string) => {
    if (kind === 'route' && !HTTP_METHODS.has(name)) return
    entries.push({ id: `${file}#${name}`, kind, fn, problem, module: mod })
  }
  const byName = (name: string): { fn: FunctionLike | null; problem?: string } => {
    const local = mod.locals.get(name)
    if (local) return { fn: local }
    for (const s of mod.sf.statements) {
      if (!ts.isVariableStatement(s)) continue
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.name.text === name) return resolveHandler(mod, d.initializer)
      }
    }
    return { fn: null, problem: `"${name}" isn't declared in this file` }
  }

  for (const s of mod.sf.statements) {
    if (ts.isFunctionDeclaration(s) && isExported(s)) {
      const isDefault = (ts.getModifiers(s) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
      add(isDefault ? 'default' : (s.name?.text ?? 'default'), s)
    } else if (ts.isVariableStatement(s) && isExported(s)) {
      for (const d of s.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) {
          add(d.name.getText(mod.sf), null, 'destructured export')
          continue
        }
        // Route segment config (`maxDuration`, `dynamic`, …) is not a handler.
        if (kind === 'route' && !HTTP_METHODS.has(d.name.text)) continue
        const { fn, problem } = resolveHandler(mod, d.initializer)
        add(d.name.text, fn, problem)
      }
    } else if (ts.isExportAssignment(s)) {
      const { fn, problem } = resolveHandler(mod, s.expression)
      add('default', fn, problem)
    } else if (ts.isExportDeclaration(s) && !s.isTypeOnly) {
      if (s.moduleSpecifier || !s.exportClause || !ts.isNamedExports(s.exportClause)) {
        add(`re-export@${mod.sf.getLineAndCharacterOfPosition(s.getStart()).line + 1}`, null, 're-exports from another module are not allowed here; export a local function')
        continue
      }
      for (const el of s.exportClause.elements) {
        if (el.isTypeOnly) continue
        const { fn, problem } = byName((el.propertyName ?? el.name).text)
        add(el.name.text, fn, problem)
      }
    }
  }

  // Inline server functions ('use server' at the top of a function body) are actions too.
  if (kind === 'action') {
    const visit = (n: ts.Node) => {
      if (isFunctionLike(n) && n.body && ts.isBlock(n.body) && hasUseServer(n.body.statements) && !isExported(n)) {
        const name = ts.isFunctionDeclaration(n) && n.name ? n.name.text : `inline@${mod.sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`
        entries.push({ id: `${file}#${name}`, kind, fn: n, module: mod })
      }
      ts.forEachChild(n, visit)
    }
    ts.forEachChild(mod.sf, visit)
  }
  return entries
}

/** A node runs every time `fn` runs: not inside a branch, loop, catch, short-circuit operand or nested function. */
function isUnconditionalIn(node: ts.Node, fn: FunctionLike) {
  let child: ts.Node = node
  for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (parent === fn) return true
    if (isFunctionLike(parent) || ts.isClassLike(parent)) return false
    if (ts.isIfStatement(parent) && child !== parent.expression) return false
    if (ts.isConditionalExpression(parent) && child !== parent.condition) return false
    if (ts.isBinaryExpression(parent) && child === parent.right) {
      const op = parent.operatorToken.kind
      if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return false
    }
    if (ts.isCallExpression(parent) && parent.questionDotToken) return false
    if (ts.isCaseClause(parent) || ts.isDefaultClause(parent) || ts.isCatchClause(parent)) return false
    if (ts.isIterationStatement(parent, false)) return false
    if (ts.isTryStatement(parent) && child !== parent.tryBlock) return false
  }
  return false
}

type CallMatch = (call: ts.CallExpression, mod: Module) => boolean

/**
 * Does `fn` unconditionally call something matching `match`, directly or through a local helper
 * that does? `awaited` additionally requires the call (or the helper call) to be awaited.
 */
function callsUnconditionally(mod: Module, fn: FunctionLike, match: CallMatch, awaited: boolean, seen = new Set<FunctionLike>()): ts.CallExpression | null {
  if (seen.has(fn) || !fn.body) return null
  seen.add(fn)
  let found: ts.CallExpression | null = null
  const visit = (n: ts.Node) => {
    if (found) return
    if (ts.isCallExpression(n) && isUnconditionalIn(n, fn) && (!awaited || isAwaitedOrReturned(n, fn))) {
      if (match(n, mod)) {
        found = n
        return
      }
      if (ts.isIdentifier(n.expression) && !mod.imports.has(n.expression.text)) {
        const helper = mod.locals.get(n.expression.text)
        if (helper && callsUnconditionally(mod, helper, match, awaited, seen)) {
          found = n
          return
        }
      }
    }
    if (isFunctionLike(n) && n !== fn) return
    ts.forEachChild(n, visit)
  }
  visit(fn.body)
  return found
}

/** `await guard()`, or `return guard()` / `() => guard()` from a helper whose own call is awaited. */
const isAwaitedOrReturned = (call: ts.CallExpression, fn: FunctionLike) =>
  ts.isAwaitExpression(call.parent) || ts.isReturnStatement(call.parent) || call.parent === fn

const importedCall =
  (names: Set<string>, from: string): CallMatch =>
  (call, mod) => {
    if (!ts.isIdentifier(call.expression)) return false
    const imported = mod.imports.get(call.expression.text)
    return !!imported && imported.from === from && names.has(imported.name)
  }

function guardNames(): Set<string> {
  const source = readFileSync(join(ROOT, 'lib/server/authz.ts'), 'utf8')
  const sf = ts.createSourceFile('authz.ts', source, ts.ScriptTarget.Latest, true)
  const names = new Set<string>()
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && isExported(s) && s.name && /^require[A-Z]/.test(s.name.text)) names.add(s.name.text)
  }
  return names
}

/** Does the first statement that calls anything include the guard call? */
function guardIsFirstCall(fn: FunctionLike, guardCall: ts.CallExpression) {
  if (!fn.body || !ts.isBlock(fn.body)) return true
  for (const statement of fn.body.statements) {
    let hasCall = false
    const visit = (n: ts.Node) => {
      if (hasCall || (isFunctionLike(n) && n !== fn)) return
      if (ts.isCallExpression(n) || ts.isNewExpression(n) || ts.isAwaitExpression(n)) hasCall = true
      else ts.forEachChild(n, visit)
    }
    visit(statement)
    if (hasCall) return guardCall.pos >= statement.pos && guardCall.end <= statement.end
  }
  return false
}

const printer = ts.createPrinter({ removeComments: true })
const normalizedText = (fn: FunctionLike, sf: ts.SourceFile) => printer.printNode(ts.EmitHint.Unspecified, fn, sf).replace(/\s+/g, ' ')

type Finding = { id: string; status: 'guarded' | 'public'; problems: string[]; guard?: string }

function checkEntry(entry: Entry, guards: Set<string>, publicList: Record<string, PublicEntry>): Finding {
  const allow = publicList[entry.id]
  const problems: string[] = []
  if (!entry.fn) return { id: entry.id, status: allow ? 'public' : 'guarded', problems: [entry.problem ?? 'no function body found'] }
  const mod = entry.module

  if (allow) {
    if (!allow.reason.trim()) problems.push('public entry needs a reason')
    if (!allow.calls?.length && !allow.patterns?.length) problems.push('public entry must name the check it does instead')
    for (const call of allow.calls ?? []) {
      if (!callsUnconditionally(mod, entry.fn, importedCall(new Set([call.name]), call.from), false)) {
        problems.push(`public entry must call ${call.name}() from ${call.from} unconditionally`)
      }
    }
    const text = normalizedText(entry.fn, mod.sf)
    for (const pattern of allow.patterns ?? []) {
      if (!pattern.test(text)) problems.push(`public entry is missing its check: ${pattern}`)
    }
    return { id: entry.id, status: 'public', problems }
  }

  const guardCall = callsUnconditionally(mod, entry.fn, importedCall(guards, AUTHZ_MODULE), true)
  if (!guardCall) {
    problems.push(`calls no authz guard (${[...guards].join(', ')}) unconditionally with await; add one or list it in PUBLIC with the check it does instead`)
    return { id: entry.id, status: 'guarded', problems }
  }
  if (!guardIsFirstCall(entry.fn, guardCall)) problems.push('the authz guard must run before any other call')
  return { id: entry.id, status: 'guarded', problems, guard: guardCall.expression.getText(mod.sf) }
}

// ─── Discovery ──────────────────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name) && !name.endsWith('.d.ts')) out.push(path)
  }
  return out
}

function discover() {
  const entries: Entry[] = []
  const files = ['app', 'components', 'lib'].flatMap((d) => walk(join(ROOT, d)))
  const actionFiles: string[] = []
  const routeFiles: string[] = []
  for (const abs of files) {
    const file = relative(ROOT, abs).split('\\').join('/')
    const source = readFileSync(abs, 'utf8')
    if (/^app\/(.*\/)?route\.(ts|tsx|js|jsx|mjs)$/.test(file)) {
      routeFiles.push(file)
      entries.push(...collectEntries(file, source, 'route'))
      continue
    }
    if (!source.includes('use server')) continue
    const mod = parseModule(file, source)
    if (hasUseServer(mod.sf.statements)) {
      actionFiles.push(file)
      entries.push(...collectEntries(file, source, 'action'))
    } else {
      // Only inline server functions.
      entries.push(...collectEntries(file, source, 'action').filter((e) => e.fn && !isExported(e.fn)))
    }
  }
  return { entries, actionFiles, routeFiles }
}

// ─── Tests ──────────────────────────────────────────────────────────────────────────────

describe('authz coverage (static)', () => {
  const guards = guardNames()
  const { entries, actionFiles, routeFiles } = discover()
  const findings = entries.map((e) => checkEntry(e, guards, PUBLIC))

  it('finds the guards, the action modules and the route handlers', () => {
    expect([...guards].sort()).toEqual(expect.arrayContaining(['requireAdmin', 'requireApprovedSponsor', 'requireNoOrg', 'requireSponsorMember', 'requireTeamMember', 'requireViewer']))
    // Every file under app/actions is a 'use server' module.
    const actionDir = readdirSync(join(ROOT, 'app/actions')).filter((f) => /\.tsx?$/.test(f)).map((f) => `app/actions/${f}`)
    expect(actionFiles).toEqual(expect.arrayContaining(actionDir))
    expect(routeFiles.length).toBeGreaterThanOrEqual(6)
    expect(entries.filter((e) => e.kind === 'action').length).toBeGreaterThanOrEqual(60)
    expect(entries.filter((e) => e.kind === 'route').length).toBe(routeFiles.length)
  })

  it('every server action and route handler is guarded or explicitly public with its check present', () => {
    const failures = findings.filter((f) => f.problems.length).map((f) => `${f.id}: ${f.problems.join('; ')}`)
    expect(failures).toEqual([])
  })

  it('the public allowlist has no stale entries', () => {
    const ids = new Set(entries.map((e) => e.id))
    expect(Object.keys(PUBLIC).filter((id) => !ids.has(id))).toEqual([])
  })

  describe('the analyzer itself', () => {
    const header = `'use server'\nimport { requireAdmin, requireViewer as rv } from '@/lib/server/authz'\nimport { defineAction } from '@/lib/server/result'\nimport { doThing } from '@/lib/server/data/things'\n`
    const check = (body: string, kind: 'action' | 'route' = 'action', list: Record<string, PublicEntry> = {}) =>
      collectEntries(kind === 'route' ? 'app/api/x/route.ts' : 'app/actions/x.ts', header + body, kind).map((e) => checkEntry(e, guards, list))

    it('accepts guarded actions, including aliases and local helpers', () => {
      const results = check(`
        export const a = defineAction(schema, async (input) => { const v = await requireAdmin(); return doThing(v, input) })
        export async function b() { await rv() }
        async function authed() { return requireAdmin() }
        export const c = defineAction(schema, async () => { const v = await authed(); return doThing(v) })
        export { d }
        const d = defineAction(schema, async () => { await requireAdmin() })
      `)
      expect(results.map((r) => [r.id, r.problems])).toEqual([
        ['app/actions/x.ts#a', []],
        ['app/actions/x.ts#b', []],
        ['app/actions/x.ts#c', []],
        ['app/actions/x.ts#d', []],
      ])
    })

    it('rejects missing, conditional, un-awaited, late, nested and look-alike guards', () => {
      const results = check(`
        export const none = defineAction(schema, async (input) => doThing(null, input))
        export const conditional = defineAction(schema, async (input) => { if (input.x) await requireAdmin(); return doThing(null, input) })
        export const shortCircuit = defineAction(schema, async (input) => { input.x && (await requireAdmin()) })
        export const notAwaited = defineAction(schema, async (input) => { requireAdmin(); return doThing(null, input) })
        export const late = defineAction(schema, async (input) => { await doThing(null, input); await requireAdmin() })
        export const nested = defineAction(schema, async (input) => { const later = async () => { await requireAdmin() }; return doThing(later, input) })
        export const inCatch = defineAction(schema, async () => { try { await doThing() } catch { await requireAdmin() } })
        export const byReference = defineAction(schema, handler)
        async function handler() { return doThing() }
        export default async function () { return doThing() }
        export { thing } from './elsewhere'
      `)
      expect(results.map((r) => r.id.split('#')[1].replace(/@\d+$/, ''))).toEqual(['none', 'conditional', 'shortCircuit', 'notAwaited', 'late', 'nested', 'inCatch', 'byReference', 'default', 're-export'])
      for (const r of results) expect(r.problems, r.id).not.toEqual([])

      const fake = collectEntries('app/actions/y.ts', `'use server'\nconst requireAdmin = async () => null\nexport async function x() { await requireAdmin() }`, 'action').map((e) => checkEntry(e, guards, {}))
      expect(fake[0].problems).not.toEqual([])
    })

    it('finds route handlers and inline server functions, and checks public entries for their stated check', () => {
      const routes = check(`
        export const maxDuration = 60
        export async function GET() { return doThing() }
        export const POST = async (request) => { if (request.headers.get('authorization') !== 'Bearer x') return new Response(null, { status: 401 }); return doThing() }
      `, 'route', { 'app/api/x/route.ts#POST': { reason: 'test', patterns: [/Bearer y/] } })
      expect(routes.map((r) => [r.id, r.status, r.problems.length > 0])).toEqual([
        ['app/api/x/route.ts#GET', 'guarded', true],
        ['app/api/x/route.ts#POST', 'public', true],
      ])

      const inline = collectEntries('app/(app)/page.tsx', `export default function Page() { async function save() { 'use server'; await doThing() } return save }`, 'action')
      expect(inline.map((e) => e.id)).toEqual(['app/(app)/page.tsx#default', 'app/(app)/page.tsx#save'])
    })
  })
})
