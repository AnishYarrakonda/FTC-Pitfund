import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'

import { BUDGETS } from './routes'

/*
 * The individual QA checks. Each returns a list of human-readable failures (empty = pass).
 */

/** Collected in the page from the first byte: LCP and CLS. */
export const PERF_INIT_SCRIPT = `
  window.__qa = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__qa.lcp = Math.max(window.__qa.lcp, e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__qa.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
`

/** Hide Next's dev-mode indicator so dev-server screenshots show only the product. */
export const HIDE_DEV_OVERLAY = `
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal { display: none !important; }';
    document.head.appendChild(style);
  });
`

/**
 * Wait until the page is visually settled: network idle, fonts loaded, finite animations done,
 * and element opacities stable (axe skips opacity:0 and mis-measures mid-fade). Infinite
 * animations (spinners, skeleton pulses) are excluded or the wait never ends.
 */
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  // Wait for React to hydrate every form control. A screenshot hides the caret by writing an inline
  // `caret-color` onto inputs; if that lands before hydration (a big page on a slow CI runner), React
  // reports a hydration mismatch that the page itself never had.
  await page
    .waitForFunction(() => Array.from(document.querySelectorAll('input, textarea, select')).every((el) => Object.keys(el).some((k) => k.startsWith('__reactProps$'))), null, { timeout: 15_000 })
    .catch(() => {})
  await page.evaluate(async () => {
    await document.fonts.ready
    const finite = document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity)
    await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => null))), new Promise((r) => setTimeout(r, 3000))])
    const snapshot = () =>
      Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((el) => !el.getAnimations().some((a) => a.effect?.getTiming().iterations === Infinity))
        .map((el) => getComputedStyle(el).opacity)
        .join(',')
    let previous = snapshot()
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100))
      const next = snapshot()
      if (next === previous) return
      previous = next
    }
  })
}

export async function checkOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const failures: string[] = []
    const doc = document.documentElement
    if (doc.scrollWidth > doc.clientWidth + 1) {
      failures.push(`page scrolls horizontally (${doc.scrollWidth}px content in ${doc.clientWidth}px)`)
    }
    const describe = (el: Element) => {
      const tag = el.tagName.toLowerCase()
      const id = el.id ? `#${el.id}` : ''
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
      return `${tag}${id} "${text}"`
    }
    const scrollableAncestor = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX
        if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true
      }
      return false
    }
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.closest('[aria-hidden="true"], .sr-only, script, style, nextjs-portal, [data-sonner-toaster]')) continue
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())
      if (!hasText) continue
      const style = getComputedStyle(el)
      if (style.display === 'inline' || style.display === 'contents' || style.visibility === 'hidden') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      // Measure the element's own text runs (not decorative absolutely positioned children).
      // Clipping containers (truncate, line-clamp) are intentional and skipped.
      if (style.overflowX === 'visible') {
        const range = document.createRange()
        let overflow = 0
        for (const node of Array.from(el.childNodes)) {
          if (node.nodeType !== Node.TEXT_NODE || !(node.textContent ?? '').trim()) continue
          range.selectNodeContents(node)
          const preserves = style.whiteSpace === 'pre-wrap' || style.whiteSpace === 'break-spaces'
          for (const r of Array.from(range.getClientRects())) {
            // pre-wrap "hangs" the space at a line break past the edge; it is invisible.
            if (preserves && r.width <= 6) continue
            overflow = Math.max(overflow, r.right - rect.right, rect.left - r.left)
          }
        }
        if (overflow > 1) {
          failures.push(`text overflows its box: ${describe(el)} (${Math.round(overflow)}px past the edge)`)
          continue
        }
      }
      // Text escaping the viewport without a scroll container to hold it.
      if (rect.right > window.innerWidth + 1 && !scrollableAncestor(el)) {
        failures.push(`text runs off screen: ${describe(el)}`)
      }
    }
    return [...new Set(failures)].slice(0, 20)
  })
}

export async function checkAxe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').analyze()
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `axe ${v.impact}: ${v.id} — ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')})`)
}

export type Perf = { ttfbMs: number; lcpMs: number; cls: number }

export async function measurePerf(page: Page): Promise<Perf> {
  await page.waitForTimeout(300)
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const qa = (window as unknown as { __qa?: { lcp: number; cls: number } }).__qa ?? { lcp: 0, cls: 0 }
    return {
      ttfbMs: Math.round(nav ? nav.responseStart - nav.requestStart : 0),
      lcpMs: Math.round(qa.lcp),
      cls: Math.round(qa.cls * 1000) / 1000,
    }
  })
}

export function perfFailures(perf: Perf, budget: 'public' | 'authed'): string[] {
  const failures: string[] = []
  const ttfb = budget === 'public' ? BUDGETS.ttfbPublicMs : BUDGETS.ttfbAuthedMs
  if (perf.ttfbMs > ttfb) failures.push(`TTFB ${perf.ttfbMs} ms exceeds ${ttfb} ms`)
  if (perf.lcpMs > BUDGETS.lcpMs) failures.push(`LCP ${perf.lcpMs} ms exceeds ${BUDGETS.lcpMs} ms`)
  if (perf.cls > BUDGETS.cls) failures.push(`CLS ${perf.cls} exceeds ${BUDGETS.cls}`)
  return failures
}

/**
 * Open every dialog/sheet/popover trigger on the page and check the overlay system (plan §7):
 * wide enough, fits the viewport, a close control that stays visible when the body scrolls,
 * a focus trap (modal overlays), Esc closes, focus returns to the trigger.
 */
export async function checkOverlays(page: Page, width: number): Promise<{ failures: string[]; opened: number }> {
  const failures: string[] = []
  const triggers = page.locator('[data-qa-overlay]:visible, [aria-haspopup="dialog"]:visible')
  const count = await triggers.count()
  let opened = 0
  for (let i = 0; i < count; i++) {
    const trigger = triggers.nth(i)
    if (await trigger.isDisabled().catch(() => true)) continue
    const label = ((await trigger.getAttribute('data-qa-overlay')) ?? (await trigger.getAttribute('aria-label')) ?? (await trigger.innerText()).trim()).slice(0, 40)
    await trigger.scrollIntoViewIfNeeded()
    await trigger.click()
    const dialog = page.locator('[role="dialog"][data-state="open"], [role="dialog"]:not([data-state])').last()
    try {
      await dialog.waitFor({ state: 'visible', timeout: 5000 })
    } catch {
      failures.push(`overlay "${label}" did not open`)
      await page.keyboard.press('Escape')
      continue
    }
    opened++
    // Work with a handle from here: a locator would silently wait forever if the overlay vanished.
    const handle = await dialog.elementHandle({ timeout: 2000 }).catch(() => null)
    await page.waitForTimeout(250)
    if (!handle || !(await handle.evaluate((el) => el.isConnected))) {
      failures.push(`overlay "${label}" closed by itself right after opening`)
      continue
    }
    const box = await handle.boundingBox()
    const modal = (await handle.getAttribute('data-overlay')) !== null
    if (box) {
      if (width >= 1024 && box.width < BUDGETS.minOverlayWidthPx) failures.push(`overlay "${label}" is ${Math.round(box.width)} px wide (min ${BUDGETS.minOverlayWidthPx})`)
      if (box.width > width + 1) failures.push(`overlay "${label}" is wider than the viewport`)
    }
    if (modal) {
      const close = await handle.$('[data-overlay-close]')
      if (!close || !(await close.isVisible())) {
        failures.push(`overlay "${label}" has no visible close control`)
      } else {
        // Scroll the body to the end; the close control must still be on screen.
        await handle.evaluate((el) => el.querySelectorAll<HTMLElement>('.overflow-y-auto').forEach((s) => (s.scrollTop = s.scrollHeight)))
        const closeBox = await close.boundingBox()
        const viewport = page.viewportSize()!
        if (!closeBox || closeBox.y < 0 || closeBox.y + closeBox.height > viewport.height) failures.push(`overlay "${label}" close control scrolls out of view`)
      }
      for (let t = 0; t < 12; t++) {
        await page.keyboard.press('Tab')
        const inside = await handle.evaluate((el) => el.contains(document.activeElement))
        if (!inside) {
          failures.push(`overlay "${label}" lets focus escape (Tab ${t + 1})`)
          break
        }
      }
    }
    await page.keyboard.press('Escape')
    try {
      await page.waitForFunction((el) => !el.isConnected || getComputedStyle(el).display === 'none', handle, { timeout: 3000 })
    } catch {
      failures.push(`overlay "${label}" did not close on Escape`)
      continue
    }
    if (modal) {
      // Radix restores focus when the overlay unmounts, after its exit animation.
      await page.waitForTimeout(250)
      const returned = await trigger.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))
      if (!returned) failures.push(`overlay "${label}" did not return focus to its trigger`)
    }
  }
  return { failures, opened }
}

/** Click each ActionButton and require the pending state within 100 ms of the click. */
export async function checkActionButtons(page: Page): Promise<{ failures: string[]; latencies: Record<string, number> }> {
  const failures: string[] = []
  const latencies: Record<string, number> = {}
  const buttons = page.locator('[data-action-button]:visible:not([disabled])')
  const count = await buttons.count()
  for (let i = 0; i < count; i++) {
    const button: Locator = buttons.nth(i)
    const label = (await button.innerText()).trim().slice(0, 40)
    // Submit buttons of forms that navigate or delete are not safe to click in a sweep.
    if (/sign|delete|continue|reset/i.test(label)) continue
    await button.scrollIntoViewIfNeeded()
    const latency = await button.evaluate(
      (el) =>
        new Promise<number>((resolve) => {
          const start = performance.now()
          const observer = new MutationObserver(() => {
            if (el.getAttribute('aria-busy') === 'true') {
              observer.disconnect()
              resolve(performance.now() - start)
            }
          })
          observer.observe(el, { attributes: true, attributeFilter: ['aria-busy'] })
          ;(el as HTMLButtonElement).click()
          setTimeout(() => {
            observer.disconnect()
            resolve(Number.POSITIVE_INFINITY)
          }, 2000)
        }),
    )
    latencies[label] = Math.round(latency * 10) / 10
    if (latency > BUDGETS.actionPendingMs) failures.push(`ActionButton "${label}" showed pending after ${Number.isFinite(latency) ? Math.round(latency) + ' ms' : 'never'}`)
    await page.waitForFunction((el) => el?.getAttribute('aria-busy') !== 'true', await button.elementHandle(), { timeout: 10_000 }).catch(() => {})
  }
  return { failures, latencies }
}
