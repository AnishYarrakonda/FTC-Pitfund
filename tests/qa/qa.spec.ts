import { mkdirSync, writeFileSync } from 'node:fs'

import { expect, test as base } from '@playwright/test'

import { watchProblems } from '../support/fixtures'
import { DEV_URL, PROD_URL } from '../support/env'

import { checkActionButtons, checkAxe, checkOverflow, checkOverlays, HIDE_DEV_OVERLAY, measurePerf, PERF_INIT_SCRIPT, perfFailures, settle, type Perf } from './checks'
import { SEED, SEED_INVITE_TOKENS } from '../../scripts/seed/ids'

import { QA_ROUTES, QA_WIDTHS } from './routes'

/*
 * npm run qa — the UX gate (plan §10). For every route × persona × width: screenshot, console /
 * network / exception failures, horizontal and text overflow, axe serious/critical, overlays,
 * performance budgets (1280 only, production build), ActionButton latency (/dev/ui).
 * Results land in qa/results/*.json; the teardown writes qa/report.json and qa/report.md.
 */

const test = base.extend<{ scenario: 'demo' | 'edge' | 'empty' }>({ scenario: ['demo', { option: true }] })

/** Seeded pitches and invites don't exist in `empty`; routes that open one are skipped there. */
const CONTENT_IDS = [...Object.values(SEED.pitches), ...Object.values(SEED_INVITE_TOKENS)]
const needsContent = (path: string) => CONTENT_IDS.some((id) => path.includes(id))

for (const route of QA_ROUTES) {
  for (const persona of route.personas) {
    for (const width of QA_WIDTHS) {
      test(`${route.name} · ${persona} · ${width}`, async ({ browser, scenario }, testInfo) => {
        test.skip(scenario === 'empty' && (needsContent(route.path) || route.server === 'dev'), 'needs seeded content')
        testInfo.setTimeout(route.name === 'dev-ui' ? 300_000 : 120_000)
        const baseURL = route.server === 'dev' ? DEV_URL : PROD_URL
        const context = await browser.newContext({
          baseURL,
          viewport: { width, height: width < 768 ? 812 : 900 },
          storageState: persona === 'anonymous' ? undefined : `tests/.auth/qa-${persona}.json`,
          reducedMotion: 'no-preference',
        })
        const page = await context.newPage()
        await page.addInitScript(PERF_INIT_SCRIPT)
        if (route.server === 'dev') await page.addInitScript(HIDE_DEV_OVERLAY)
        const expected404 = route.expectStatus === 404
        const problems = watchProblems(page, {
          allow: expected404 ? [/404/, /Failed to load resource/] : [],
        })
        const failures: string[] = []

        if (route.budget && width === 1280) {
          // Warm the route once so the measurement is a steady-state request, not a cold start.
          await context.request.get(route.path).catch(() => null)
        }
        const response = await page.goto(route.path, { waitUntil: 'load' })
        const status = response?.status() ?? 0
        if (status !== (route.expectStatus ?? 200)) failures.push(`HTTP ${status}, expected ${route.expectStatus ?? 200}`)
        if (new URL(page.url()).pathname + new URL(page.url()).search !== route.path) failures.push(`redirected to ${page.url()}`)

        await settle(page)

        let perf: Perf | null = null
        if (route.budget && width === 1280) {
          perf = await measurePerf(page)
          failures.push(...perfFailures(perf, route.budget))
        }

        const dir = `qa/screens/${route.name}`
        mkdirSync(dir, { recursive: true })
        const screenshot = `${dir}/${persona}-${width}${scenario === 'demo' ? '' : `-${scenario}`}.png`
        await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })

        failures.push(...(await checkOverflow(page)))
        failures.push(...(await checkAxe(page)))

        const overlays = await checkOverlays(page, width)
        failures.push(...overlays.failures)
        failures.push(...(await checkOverflow(page)).map((f) => `after overlays: ${f}`))

        // States reachable only by interaction: fresh page, run the steps, then the same checks.
        const interactions: string[] = []
        for (const interaction of route.interactions ?? []) {
          if (interaction.widths && !interaction.widths.includes(width)) continue
          await page.goto(route.path, { waitUntil: 'load' })
          await settle(page)
          const problemsBefore = problems.length
          try {
            await interaction.run(page)
          } catch (e) {
            failures.push(`interaction "${interaction.name}" failed: ${(e instanceof Error ? e.message : String(e)).split('\n')[0]}`)
            continue
          }
          await settle(page)
          const caused = problems.splice(problemsBefore)
          problems.push(...caused.filter((p) => !interaction.expectedErrors?.some((r) => r.test(p))))
          await page.screenshot({ path: screenshot.replace(/\.png$/, `--${interaction.name}.png`), fullPage: true, animations: 'disabled' })
          failures.push(...(await checkOverflow(page)).map((f) => `${interaction.name}: ${f}`))
          failures.push(...(await checkAxe(page)).map((f) => `${interaction.name}: ${f}`))
          interactions.push(interaction.name)
        }

        let latencies: Record<string, number> | undefined
        if (route.actionButtons && width === 1280) {
          const actions = await checkActionButtons(page)
          failures.push(...actions.failures)
          latencies = actions.latencies
        }

        failures.push(...problems)
        const unique = [...new Set(failures)]

        mkdirSync('qa/results', { recursive: true })
        writeFileSync(
          `qa/results/${scenario}-${route.name}-${persona}-${width}.json`,
          JSON.stringify({ scenario, route: route.name, path: route.path, persona, width, screenshot, status, perf, overlaysOpened: overlays.opened, interactions, latencies, failures: unique }, null, 2),
        )
        await context.close()
        expect(unique, `QA failures for ${route.path} as ${persona} at ${width}px`).toEqual([])
      })
    }
  }
}
