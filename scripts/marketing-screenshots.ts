/*
 * npm run screenshots:marketing
 *
 * Real product screenshots for the landing page, never drawn by hand: seeds `demo`, signs in the
 * personas without the UI, and captures the pitch composer (coach) at 1280 px, a pitch in a company inbox
 * (sponsor) and the public team page (anonymous) at narrower widths, all @2x, on the local production build
 * (:3100, started if it isn't running). Each capture is re-encoded to WebP in public/marketing/.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

import { chromium, type Page } from '@playwright/test'

import { settle } from '../tests/qa/checks'
import { assertLocalStack, PROD_URL } from '../tests/support/env'
import { seed } from '../tests/support/seed'
import { storageStateViaToken } from '../tests/support/session'

import { SEED } from './seed/ids'

const OUT = 'public/marketing'
const VIEWPORT = { width: 1280, height: 820 }

type Shot = {
  file: string
  path: string
  persona: 'coach' | 'sponsor' | null
  /** The element to capture, cropped to the viewport height. */
  selector: string
  /** Shots shown beside text use a narrower window so the product's type stays legible. */
  width?: number
  prepare?: (page: Page) => Promise<void>
}

const ANSWERS = [
  'Four parents started Exodius in a garage in 2021. Today two coaches and a mentor from a local machine shop run it, and the students lead every subgroup.',
  'Eighteen students from three high schools. We recruit at middle school STEM nights and run a two-week summer camp where new members build their first mechanism.',
]

const SHOTS: Shot[] = [
  {
    file: 'composer',
    path: `/sponsors/${SEED.keystone}/pitch`,
    persona: 'coach',
    selector: 'main',
    prepare: async (page) => {
      const boxes = page.getByRole('textbox')
      for (let i = 0; i < ANSWERS.length; i++) await boxes.nth(i).fill(ANSWERS[i])
      await page.getByText(/Saved ·/).first().waitFor({ timeout: 15_000 })
      await page.evaluate(() => window.scrollTo(0, 0))
      ;(await page.$('main :focus'))?.evaluate((el) => (el as HTMLElement).blur())
    },
  },
  { file: 'inbox-pitch', path: `/inbox/${SEED.pitches.voltageToBrightlineSent}`, persona: 'sponsor', selector: 'main', width: 1000 },
  { file: 'team-page', path: `/t/${SEED.exodius.number}`, persona: null, selector: 'main', width: 900 },
]

async function serverUp() {
  try {
    return (await fetch(`${PROD_URL}/api/health`, { signal: AbortSignal.timeout(2000) })).ok
  } catch {
    return false
  }
}

async function ensureServer() {
  if (await serverUp()) return null
  console.log('▸ Starting the local production server (:3100)')
  const child = spawn(process.execPath, ['--import', 'tsx', '--import', './scripts/lib/server-only-stub.mjs', 'scripts/serve-prod.ts'], { stdio: 'inherit' })
  for (let i = 0; i < 600; i++) {
    if (await serverUp()) return child
    await new Promise((r) => setTimeout(r, 1000))
  }
  child.kill()
  throw new Error('The production server did not start.')
}

async function toWebp(page: Page, png: Buffer): Promise<Buffer> {
  const dataUrl = await page.evaluate(async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    return canvas.toDataURL('image/webp', 0.84)
  }, `data:image/png;base64,${png.toString('base64')}`)
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

async function main() {
  assertLocalStack()
  console.log('▸ Seeding demo')
  seed('demo')
  const server = await ensureServer()
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const shot of SHOTS) {
      const storageState = shot.persona ? await storageStateViaToken(shot.persona) : undefined
      const viewport = { width: shot.width ?? VIEWPORT.width, height: VIEWPORT.height }
      const context = await browser.newContext({ baseURL: PROD_URL, viewport, deviceScaleFactor: 2, storageState, reducedMotion: 'reduce' })
      // tsx keeps function names with a `__name` helper that doesn't exist inside the page.
      await context.addInitScript('globalThis.__name = (fn) => fn')
      const page = await context.newPage()
      await page.goto(shot.path, { waitUntil: 'load' })
      await settle(page)
      await shot.prepare?.(page)
      await settle(page)
      const box = await page.locator(shot.selector).first().boundingBox()
      if (!box) throw new Error(`${shot.path}: ${shot.selector} not found`)
      const png = await page.screenshot({
        clip: { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height, box.y + box.height) },
        animations: 'disabled',
        caret: 'hide',
      })
      const webp = await toWebp(page, png)
      writeFileSync(`${OUT}/${shot.file}.webp`, webp)
      console.log(`✓ ${OUT}/${shot.file}.webp (${Math.round(webp.length / 1024)} KB)`)
      await context.close()
    }
  } finally {
    await browser.close()
    server?.kill()
  }
  // The composer shot saved a draft; put the demo data back.
  seed('demo')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
