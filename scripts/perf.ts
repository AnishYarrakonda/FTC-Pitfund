/*
 * npm run perf [-- --only bundles,lighthouse,server,actions]
 *
 * The plan §6 budgets, measured on the local production build (:3100, built and started if needed)
 * with the `demo` seed. Fails (exit 1) on any miss; results go to qa/perf/.
 *
 *   bundles     First-load JS per route: every QA route on the production server, as its first
 *               persona. Every script the page's HTML references (what it needs to hydrate; lazy
 *               chunks and link prefetches come later), counted as its gzip -9 size. Link prefetches
 *               and lazy chunks (pdf.js, dialogs opened on click) come later and don't count.
 *               Budget 170 KB.
 *   lighthouse  Lighthouse mobile with applied Slow 4G throttling (150 ms RTT, 1.6 Mbit/s, 4× CPU) on /, /t/31579 and /login, three
 *               runs each, median: performance ≥ 90, accessibility ≥ 95, LCP ≤ 2 s, CLS ≤ 0.05.
 *   server      Authed pages (/pitches, /sponsors, /inbox, /admin, /admin/pitches/[id]): queries per
 *               request from a second production server on :3101 started with DEBUG_QUERIES=1
 *               (lib/server/db.ts logs one line per query; requests run one at a time), and server
 *               render time (full response) on :3100, 20 warm requests, p95 ≤ 400 ms, ≤ 5 queries.
 *   actions     Server action latency: the composer's autosave (saveDraftAction) 15 times as the
 *               coach, measured from request start to response end in the browser, p95 ≤ 500 ms.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

import { chromium, type Browser, type BrowserContextOptions } from '@playwright/test'
import lighthouse from 'lighthouse'

import type { PersonaKey } from '../lib/shared/personas'
import { BUDGETS, QA_ROUTES } from '../tests/qa/routes'
import { assertLocalStack, PROD_URL } from '../tests/support/env'
import { seed } from '../tests/support/seed'
import { storageStateViaToken } from '../tests/support/session'

import { argValue } from './lib/env'
import { ensureProdServer, stopServer, waitForServer } from './lib/prod-server'
import { SEED } from './seed/ids'

const OUT = 'qa/perf'
const QUERY_PORT = 3101
const parts = new Set((argValue('only') ?? 'bundles,lighthouse,server,actions').split(','))

const failures: string[] = []
const kb = (bytes: number) => Math.round(bytes / 1024)
const p95 = (values: number[]) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)]
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

const sessions = new Map<PersonaKey, string>()
async function storageState(persona: PersonaKey | 'anonymous'): Promise<BrowserContextOptions['storageState']> {
  if (persona === 'anonymous') return undefined
  if (!sessions.has(persona)) sessions.set(persona, await storageStateViaToken(persona))
  return sessions.get(persona)
}

async function cookieHeader(persona: PersonaKey) {
  const path = (await storageState(persona)) as string
  const state = JSON.parse(readFileSync(path, 'utf8')) as { cookies: Array<{ name: string; value: string }> }
  return state.cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}

function table(rows: Array<Record<string, string | number>>) {
  const keys = Object.keys(rows[0] ?? {})
  const width = (k: string) => Math.max(k.length, ...rows.map((r) => String(r[k]).length))
  console.log(keys.map((k) => k.padEnd(width(k))).join('  '))
  for (const r of rows) console.log(keys.map((k) => String(r[k]).padEnd(width(k))).join('  '))
}

// ─── First-load JS ──────────────────────────────────────────────────────────────────────

async function bundles(browser: Browser) {
  console.log('\n▸ First-load JS per route (gzip -9 of the scripts the HTML references)')
  const rows: Array<{ route: string; persona: string; kb: number; scripts: number; ok: string }> = []
  for (const route of QA_ROUTES) {
    if (route.server === 'dev') continue
    const persona = route.personas[0]
    const context = await browser.newContext({ baseURL: PROD_URL, storageState: await storageState(persona) })
    const page = await context.newPage()
    // The scripts the HTML itself references: what the page needs to hydrate. Counting network
    // requests instead picks up link prefetches whenever an image delays the load event.
    const response = await page.goto(route.path, { waitUntil: 'load' })
    const html = (await response?.text()) ?? ''
    const urls = [...new Set([...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]).filter((tag) => !/\bnomodule\b/i.test(tag)).map((tag) => tag.match(/\ssrc="([^"]+)"/)?.[1]).filter((src): src is string => Boolean(src)))].map((src) => new URL(src, PROD_URL).toString())
    // gzip -9 of each script body, as Next reports sizes.
    const sizes = await Promise.all(urls.map(async (url) => gzipSync(Buffer.from(await (await fetch(url)).arrayBuffer()), { level: 9 }).length))
    const bytes = sizes.reduce((sum, n) => sum + n, 0)
    const scripts = urls.length
    const ok = kb(bytes) <= BUDGETS.firstLoadJsKb
    if (!ok) failures.push(`first-load JS ${route.path} (${persona}): ${kb(bytes)} KB > ${BUDGETS.firstLoadJsKb} KB`)
    rows.push({ route: route.path, persona, kb: kb(bytes), scripts, ok: ok ? '✓' : '✗' })
    await context.close()
  }
  rows.sort((a, b) => b.kb - a.kb)
  table(rows)
  writeFileSync(`${OUT}/bundles.json`, JSON.stringify(rows, null, 2))
}

// ─── Lighthouse ─────────────────────────────────────────────────────────────────────────

async function lighthouseRuns() {
  console.log('\n▸ Lighthouse (mobile, applied Slow 4G throttling), median of 3')
  const port = 9333
  const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] })
  const rows: Array<Record<string, string | number>> = []
  const results: Record<string, unknown> = {}
  try {
    for (const path of ['/', `/t/${SEED.exodius.number}`, '/login']) {
      const runs: Array<{ performance: number; accessibility: number; lcpMs: number; cls: number; tbtMs: number }> = []
      for (let i = 0; i < 3; i++) {
        // Applied ("devtools") throttling with Lighthouse's mobile Slow 4G profile. Its default simulated
        // throttling extrapolates from an unthrottled trace, and on a local server that trace finishes in
        // ~100 ms: whether the LCP paint lands before or after the scripts start swings LCP by ±500 ms.
        const result = await lighthouse(`${PROD_URL}${path}`, { port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility'], throttlingMethod: 'devtools' })
        if (!result) throw new Error(`Lighthouse returned nothing for ${path}`)
        const { lhr } = result
        runs.push({
          performance: Math.round((lhr.categories.performance.score ?? 0) * 100),
          accessibility: Math.round((lhr.categories.accessibility.score ?? 0) * 100),
          lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue ?? 0),
          cls: Number((lhr.audits['cumulative-layout-shift'].numericValue ?? 0).toFixed(3)),
          tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue ?? 0),
        })
      }
      const m = {
        performance: median(runs.map((r) => r.performance)),
        accessibility: median(runs.map((r) => r.accessibility)),
        lcpMs: median(runs.map((r) => r.lcpMs)),
        cls: median(runs.map((r) => r.cls)),
        tbtMs: median(runs.map((r) => r.tbtMs)),
      }
      results[path] = { median: m, runs }
      const miss = [
        m.performance < BUDGETS.lighthousePerformance && `performance ${m.performance} < ${BUDGETS.lighthousePerformance}`,
        m.accessibility < BUDGETS.lighthouseAccessibility && `accessibility ${m.accessibility} < ${BUDGETS.lighthouseAccessibility}`,
        m.lcpMs > BUDGETS.lcpMs && `LCP ${m.lcpMs} ms > ${BUDGETS.lcpMs} ms`,
        m.cls > BUDGETS.cls && `CLS ${m.cls} > ${BUDGETS.cls}`,
      ].filter(Boolean)
      for (const f of miss) failures.push(`lighthouse ${path}: ${f}`)
      rows.push({ page: path, performance: m.performance, accessibility: m.accessibility, 'LCP ms': m.lcpMs, CLS: m.cls, 'TBT ms': m.tbtMs, ok: miss.length ? '✗' : '✓' })
    }
  } finally {
    await browser.close()
  }
  table(rows)
  writeFileSync(`${OUT}/lighthouse.json`, JSON.stringify(results, null, 2))
}

// ─── Queries and render time ────────────────────────────────────────────────────────────

const AUTHED_PAGES: Array<{ path: string; persona: PersonaKey }> = [
  { path: '/pitches', persona: 'coach' },
  { path: '/sponsors', persona: 'coach' },
  { path: '/inbox', persona: 'sponsor' },
  { path: '/admin', persona: 'admin' },
  { path: `/admin/pitches/${SEED.pitches.lotusToBrightlineInReview}`, persona: 'admin' },
]

async function timedGet(url: string, cookie: string) {
  const start = performance.now()
  const res = await fetch(url, { headers: { cookie }, redirect: 'manual' })
  await res.text()
  return { ms: performance.now() - start, status: res.status }
}

async function server() {
  console.log(`\n▸ Authed pages: queries per request (:${QUERY_PORT}, DEBUG_QUERIES=1) and render time (:3100)`)
  const queryServer = spawn('npx', ['next', 'start', '-H', '127.0.0.1', '-p', String(QUERY_PORT)], {
    env: { ...process.env, DEBUG_QUERIES: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
    detached: true,
  })
  let queryLines = 0
  queryServer.stdout.on('data', (chunk: Buffer) => {
    queryLines += chunk.toString().split('\n').filter((line) => line.startsWith('[db] #')).length
  })
  const rows: Array<Record<string, string | number>> = []
  try {
    if (!(await waitForServer(`http://127.0.0.1:${QUERY_PORT}`, 60))) throw new Error(`The query-counting server on :${QUERY_PORT} did not start.`)
    for (const { path, persona } of AUTHED_PAGES) {
      const cookie = await cookieHeader(persona)
      // Queries: warm the page's caches, then count three requests one at a time.
      for (let i = 0; i < 2; i++) await timedGet(`http://127.0.0.1:${QUERY_PORT}${path}`, cookie)
      const counts: number[] = []
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 150))
        const before = queryLines
        const { status } = await timedGet(`http://127.0.0.1:${QUERY_PORT}${path}`, cookie)
        await new Promise((r) => setTimeout(r, 150))
        if (status !== 200) failures.push(`server ${path}: status ${status} as ${persona}`)
        counts.push(queryLines - before)
      }
      // Render time on the normal server.
      for (let i = 0; i < 3; i++) await timedGet(`${PROD_URL}${path}`, cookie)
      const times: number[] = []
      for (let i = 0; i < 20; i++) times.push((await timedGet(`${PROD_URL}${path}`, cookie)).ms)
      const queries = Math.max(...counts)
      const renderP95 = Math.round(p95(times))
      const miss = [queries > BUDGETS.queriesPerPage && `${queries} queries > ${BUDGETS.queriesPerPage}`, renderP95 > BUDGETS.renderP95Ms && `render p95 ${renderP95} ms > ${BUDGETS.renderP95Ms} ms`].filter(Boolean)
      for (const f of miss) failures.push(`server ${path}: ${f}`)
      rows.push({ page: path, persona, queries, 'render p50 ms': Math.round(median(times)), 'render p95 ms': renderP95, ok: miss.length ? '✗' : '✓' })
    }
  } finally {
    if (queryServer.pid) process.kill(-queryServer.pid, 'SIGTERM')
  }
  table(rows)
  writeFileSync(`${OUT}/server.json`, JSON.stringify(rows, null, 2))
}

// ─── Server actions ─────────────────────────────────────────────────────────────────────

async function actions(browser: Browser) {
  console.log('\n▸ Server action latency: composer autosave as the coach')
  const context = await browser.newContext({ baseURL: PROD_URL, storageState: await storageState('coach') })
  const page = await context.newPage()
  const durations: number[] = []
  page.on('requestfinished', (request) => {
    if (request.method() !== 'POST' || !request.headers()['next-action']) return
    const t = request.timing()
    if (t.responseEnd > 0) durations.push(t.responseEnd - Math.max(t.requestStart, 0))
  })
  await page.goto(`/sponsors/${SEED.keystone}/pitch`, { waitUntil: 'networkidle' })
  const box = page.getByRole('textbox').first()
  for (let i = 0; i < 16; i++) {
    const before = durations.length
    await box.fill(`Autosave timing sample ${i}: Exodius started in a garage in 2021.`)
    for (let wait = 0; wait < 100 && durations.length === before; wait++) await page.waitForTimeout(100)
  }
  await context.close()
  // The first save also warms the action's module; drop it.
  const samples = durations.slice(1)
  const actionP95 = Math.round(p95(samples))
  const ok = samples.length >= 10 && actionP95 <= BUDGETS.actionP95Ms
  if (samples.length < 10) failures.push(`actions: only ${samples.length} autosaves were measured`)
  else if (!ok) failures.push(`actions: saveDraftAction p95 ${actionP95} ms > ${BUDGETS.actionP95Ms} ms`)
  table([{ action: 'saveDraftAction', samples: samples.length, 'p50 ms': Math.round(median(samples)), 'p95 ms': actionP95, ok: ok ? '✓' : '✗' }])
  writeFileSync(`${OUT}/actions.json`, JSON.stringify({ saveDraftAction: samples.map(Math.round) }, null, 2))
}

async function main() {
  assertLocalStack()
  mkdirSync(OUT, { recursive: true })
  console.log('▸ Seeding demo')
  seed('demo')
  const prod = await ensureProdServer(PROD_URL)
  const browser = await chromium.launch()
  try {
    if (parts.has('bundles')) await bundles(browser)
    if (parts.has('lighthouse')) await lighthouseRuns()
    if (parts.has('server')) await server()
    if (parts.has('actions')) await actions(browser)
  } finally {
    await browser.close()
    stopServer(prod)
    // Autosave changed a draft; put the demo data back.
    if (parts.has('actions')) seed('demo')
  }
  writeFileSync(`${OUT}/failures.json`, JSON.stringify(failures, null, 2))
  if (failures.length) {
    console.error(`\n✗ ${failures.length} budget miss${failures.length === 1 ? '' : 'es'}:\n${failures.map((f) => `  - ${f}`).join('\n')}`)
    process.exit(1)
  }
  console.log('\n✓ Every performance budget is met.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exit(1)
})
