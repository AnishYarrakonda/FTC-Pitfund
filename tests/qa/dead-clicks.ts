/*
 * npm run qa:clicks — the dead-click audit (prompt 4 §C4).
 *
 * For every production route in tests/qa/routes.ts (as its first persona, 1280 px, plus the
 * mobile menu at 375 px), on a freshly seeded `demo`:
 *   - every visible, enabled button (and [role=button], [role=tab], summary) is clicked on a fresh
 *     load, and must produce something within 150 ms: a DOM change (text, a dialog, aria-busy,
 *     data-state…), a navigation or router request, a server action request, a file chooser, or a
 *     browser dialog. Anything else is a dead click.
 *   - every link must go somewhere: not empty, `#` or `javascript:`, and an in-page `#id` must exist.
 * Server actions change data, so `demo` is reseeded after any route where one ran.
 * Writes qa/dead-clicks.json and qa/dead-clicks.md; exits 1 on any finding.
 */
import { mkdirSync, writeFileSync } from 'node:fs'

import { chromium, type Browser, type Page } from '@playwright/test'

import { PROD_URL, assertLocalStack } from '../support/env'
import { seed } from '../support/seed'
import { storageStateViaToken } from '../support/session'
import { ensureProdServer, stopServer } from '../../scripts/lib/prod-server'

import { QA_ROUTES } from './routes'

type Finding = { route: string; persona: string; width: number; element: string; problem: string }

const WINDOW_MS = 150
const MAX_BUTTONS = 40

const CANDIDATES = 'button, [role="button"], [role="tab"], summary'

async function open(browser: Browser, path: string, persona: string, width: number) {
  const storageState = persona === 'anonymous' ? undefined : await storageStateViaToken(persona as Parameters<typeof storageStateViaToken>[0])
  const context = await browser.newContext({ baseURL: PROD_URL, viewport: { width, height: 900 }, storageState, reducedMotion: 'reduce' })
  await context.addInitScript('globalThis.__name = (fn) => fn')
  const page = await context.newPage()
  await page.goto(path, { waitUntil: 'networkidle' })
  return { context, page }
}

/** Accessible-ish names of the clickable candidates, in document order. */
function listButtons(page: Page) {
  return page.evaluate((selector) => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[inert], [aria-hidden="true"]')
    }
    return [...document.querySelectorAll(selector)]
      .filter((el) => visible(el) && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true')
      .map((el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || `<${el.tagName.toLowerCase()}>`)
  }, CANDIDATES)
}

function checkLinks(page: Page) {
  return page.evaluate(() => {
    const problems: Array<{ element: string; problem: string }> = []
    for (const a of document.querySelectorAll<HTMLAnchorElement>('a')) {
      const r = a.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const href = a.getAttribute('href')
      const name = (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
      if (href === null || href === '' || href === '#' || href.startsWith('javascript:')) problems.push({ element: name, problem: `link goes nowhere (href="${href ?? ''}")` })
      else if (href.startsWith('#') && !document.getElementById(decodeURIComponent(href.slice(1)))) problems.push({ element: name, problem: `in-page link to missing ${href}` })
    }
    return problems
  })
}

/** Clicks the nth candidate and reports what, if anything, happened within the window. */
async function clickAndObserve(page: Page, index: number): Promise<{ live: boolean; action: boolean; what: string }> {
  const events: string[] = []
  let action = false
  const onRequest = (req: { isNavigationRequest(): boolean; headers(): Record<string, string>; method(): string }) => {
    const headers = req.headers()
    if (req.isNavigationRequest()) events.push('navigation')
    else if (headers['next-action']) {
      action = true
      events.push('server action')
    } else if (headers.rsc || headers['next-router-state-tree']) events.push('router request')
  }
  const onChooser = () => events.push('file chooser')
  const onDialog = (d: { dismiss(): Promise<void> }) => {
    events.push('browser dialog')
    void d.dismiss()
  }
  page.on('request', onRequest)
  page.on('filechooser', onChooser)
  page.on('dialog', onDialog)
  await page.evaluate(() => {
    const w = window as unknown as { __dcMutations: number; __dcObserver?: MutationObserver }
    w.__dcMutations = 0
    w.__dcObserver?.disconnect()
    w.__dcObserver = new MutationObserver((records) => {
      w.__dcMutations += records.length
    })
    w.__dcObserver.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
  })
  const target = page.locator(CANDIDATES).filter({ visible: true }).nth(index)
  const before = page.url()
  await target.click({ timeout: 2000, noWaitAfter: true }).catch((e: Error) => events.push(`click failed: ${e.message.split('\n')[0]}`))
  await page.waitForTimeout(WINDOW_MS)
  const mutations = await page.evaluate(() => (window as unknown as { __dcMutations: number }).__dcMutations).catch(() => 1)
  if (mutations > 0) events.push(`${mutations} DOM changes`)
  if (page.url() !== before) events.push('url changed')
  page.off('request', onRequest)
  page.off('filechooser', onChooser)
  page.off('dialog', onDialog)
  const failed = events.some((e) => e.startsWith('click failed'))
  return { live: events.length > 0 && !failed, action, what: events.join(', ') || 'nothing' }
}

async function auditRoute(browser: Browser, route: (typeof QA_ROUTES)[number], persona: string, width: number, findings: Finding[]) {
  let { context, page } = await open(browser, route.path, persona, width)
  const names = (await listButtons(page)).slice(0, MAX_BUTTONS)
  for (const problem of await checkLinks(page)) findings.push({ route: route.path, persona, width, ...problem })
  let mutated = false
  for (let i = 0; i < names.length; i++) {
    if (i > 0) {
      await context.close()
      ;({ context, page } = await open(browser, route.path, persona, width))
    }
    // The candidate list can shift if the page differs between loads; match by position and name.
    const current = await listButtons(page)
    if (current[i] !== names[i]) continue
    const result = await clickAndObserve(page, i)
    if (result.action) mutated = true
    if (!result.live) findings.push({ route: route.path, persona, width, element: names[i], problem: `dead click (${result.what})` })
  }
  await context.close()
  return mutated
}

async function main() {
  assertLocalStack()
  seed('demo')
  const server = await ensureProdServer(PROD_URL)
  const browser = await chromium.launch()
  const findings: Finding[] = []
  let audited = 0
  try {
    const routes = QA_ROUTES.filter((r) => r.server !== 'dev' && (r.expectStatus ?? 200) === 200)
    for (const route of routes) {
      const persona = route.personas[0]
      process.stdout.write(`▸ ${route.path} (${persona}) `)
      const before = findings.length
      const mutated = await auditRoute(browser, route, persona, 1280, findings)
      audited++
      console.log(findings.length > before ? `✗ ${findings.length - before}` : '✓')
      if (mutated) seed('demo')
    }
    // The mobile menu (and its sheet's buttons) only exist below 640 px.
    process.stdout.write('▸ /pitches (coach, 375 px) ')
    const before = findings.length
    await auditRoute(browser, { name: 'pitches-mobile', path: '/pitches', personas: ['coach'] }, 'coach', 375, findings)
    console.log(findings.length > before ? `✗ ${findings.length - before}` : '✓')
  } finally {
    await browser.close()
    stopServer(server)
    seed('demo')
  }

  mkdirSync('qa', { recursive: true })
  writeFileSync('qa/dead-clicks.json', JSON.stringify(findings, null, 2))
  const md = [
    '# Dead-click audit',
    '',
    `${audited + 1} route checks · ${findings.length} finding${findings.length === 1 ? '' : 's'}`,
    '',
    ...findings.map((f) => `- \`${f.route}\` (${f.persona}, ${f.width}px) **${f.element}**: ${f.problem}`),
  ]
  writeFileSync('qa/dead-clicks.md', md.join('\n') + '\n')
  if (findings.length) {
    console.error(`\n✗ ${findings.length} finding${findings.length === 1 ? '' : 's'}; see qa/dead-clicks.md`)
    process.exit(1)
  }
  console.log('\n✓ No dead clicks.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : e)
  process.exit(1)
})
