/*
 * Seed-time assets: small real PDFs (pdf-lib) and simple generated PNG logos and page
 * thumbnails, so the data model and UI are exercised with real files, not placeholders.
 */
import { deflateSync } from 'node:zlib'

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'

import { THUMB_WIDTH_PX } from '@/lib/shared/team'

// ─── PNG ────────────────────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array) {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Encode RGB pixels (3 bytes per pixel, row-major) as a PNG. */
function encodePng(width: number, height: number, rgbPixels: Uint8Array, level = 9): Uint8Array {
  const ihdr = new Uint8Array(13)
  const v = new DataView(ihdr.buffer)
  v.setUint32(0, width)
  v.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolor
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0
    raw.set(rgbPixels.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1)
  }
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level })),
    chunk('IEND', new Uint8Array()),
  ]
  const total = parts.reduce((n, p) => n + p.length, 0)
  const png = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    png.set(p, offset)
    offset += p.length
  }
  return png
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

type Shape = 'circle' | 'ring' | 'diamond' | 'bars' | 'chevron' | 'hex'

/** A 256×256 mark: a solid color field with one simple white shape, anti-aliased. */
export function generateLogo(color: string, shape: Shape, size = 256): Uint8Array {
  const [r, g, b] = hexToRgb(color)
  const px = new Uint8Array(size * size * 3)
  const inside = (x: number, y: number) => {
    const cx = x - 0.5
    const cy = y - 0.5
    const d = Math.hypot(cx, cy)
    switch (shape) {
      case 'circle':
        return d < 0.26
      case 'ring':
        return d < 0.3 && d > 0.17
      case 'diamond':
        return Math.abs(cx) + Math.abs(cy) < 0.3
      case 'bars':
        return Math.abs(cy) < 0.26 && [-0.18, 0, 0.18].some((bx) => Math.abs(cx - bx) < 0.055)
      case 'chevron':
        return Math.abs(cy + Math.abs(cx) * 0.9 - 0.06) < 0.07 && Math.abs(cx) < 0.3
      case 'hex': {
        const ax = Math.abs(cx)
        const ay = Math.abs(cy)
        return ay < 0.26 && ax * 0.866 + ay * 0.5 < 0.26
      }
    }
  }
  const samples = [0.25, 0.75]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hit = 0
      for (const sy of samples) for (const sx of samples) if (inside((x + sx) / size, (y + sy) / size)) hit++
      const a = hit / 4
      const i = (y * size + x) * 3
      px[i] = Math.round(r + (255 - r) * a)
      px[i + 1] = Math.round(g + (255 - g) * a)
      px[i + 2] = Math.round(b + (255 - b) * a)
    }
  }
  return encodePng(size, size, px)
}

/**
 * A page-1 thumbnail in US Letter ratio: white page, colored header, text lines.
 *
 * Sized like a real upload (THUMB_WIDTH_PX). A 300px stub used to be stretched across the whole
 * deck column, so the seeded app looked blurry in a way the real one wasn't.
 */
export function generateDeckThumbnail(color: string): Uint8Array {
  const w = THUMB_WIDTH_PX
  const h = Math.round((THUMB_WIDTH_PX * 792) / 612)
  const [r, g, b] = hexToRgb(color)
  const px = new Uint8Array(w * h * 3).fill(255)
  const fill = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => {
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) px.set(c, (y * w + x) * 3)
  }
  fill(0, 0, w, 92, [r, g, b])
  fill(24, 30, 170, 44, [255, 255, 255])
  fill(24, 54, 120, 62, [Math.min(255, r + 90), Math.min(255, g + 90), Math.min(255, b + 90)])
  const grey: [number, number, number] = [214, 214, 219]
  const dark: [number, number, number] = [120, 120, 128]
  let y = 118
  for (let block = 0; block < 4; block++) {
    fill(24, y, 110, y + 8, dark)
    y += 16
    for (let line = 0; line < 3; line++) {
      fill(24, y, line === 2 ? 180 : 276, y + 5, grey)
      y += 11
    }
    y += 10
  }
  return encodePng(w, h, px)
}

// ─── PDF ────────────────────────────────────────────────────────────────────────────────

export type DeckContent = {
  teamName: string
  teamNumber: number
  location: string
  color: string
  pages: number
  /** Adds a large incompressible image so the file lands just under 10 MB. */
  maxSize?: boolean
  /** Adds a smaller noise image of this side length (px) instead, e.g. 820 for ~2 MB. */
  noiseSide?: number
}

const SECTIONS: Array<[string, string[]]> = [
  [
    'Who we are',
    [
      'We are a community FTC team of high school students who design, build and program a robot for each season’s game.',
      'Our members split into mechanical, software and outreach groups, and everyone rotates through the build at least once.',
    ],
  ],
  [
    'What sponsorship makes possible',
    [
      'Registration and event fees for two qualifiers and the state championship.',
      'Aluminum extrusion, motors and a spare control hub so a single failure doesn’t end a match day.',
      'Travel for the full team, so no student stays home because of cost.',
    ],
  ],
  [
    'This season’s goals',
    [
      'Qualify for the state championship with a robot that scores reliably in both autonomous and driver-controlled periods.',
      'Document our engineering process in a public notebook and mentor two rookie teams in our region.',
    ],
  ],
  [
    'Outreach',
    [
      'We run free robotics workshops at our public library every month and demo at elementary school STEM nights.',
      'Last season we reached more than 600 students and families across our county.',
    ],
  ],
  [
    'How we recognize sponsors',
    [
      'Your logo on the robot, our team shirts and our website, plus a thank-you in our season video.',
      'An invitation to visit the build space and see the robot run before competition.',
    ],
  ],
]

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawPage(page: PDFPage, index: number, deck: DeckContent, fonts: { regular: PDFFont; bold: PDFFont }) {
  const { width, height } = page.getSize()
  const [r, g, b] = hexToRgb(deck.color).map((c) => c / 255)
  const ink = rgb(0.043, 0.043, 0.047)
  const muted = rgb(0.32, 0.32, 0.36)

  if (index === 0) {
    page.drawRectangle({ x: 0, y: height - 220, width, height: 220, color: rgb(r, g, b) })
    page.drawText(deck.teamName.slice(0, 40), { x: 56, y: height - 120, size: 34, font: fonts.bold, color: rgb(1, 1, 1) })
    page.drawText(`FTC Team ${deck.teamNumber} · ${deck.location}`, {
      x: 56,
      y: height - 158,
      size: 14,
      font: fonts.regular,
      color: rgb(1, 1, 1),
    })
    page.drawText('Sponsorship deck', { x: 56, y: height - 270, size: 22, font: fonts.bold, color: ink })
  } else {
    page.drawRectangle({ x: 0, y: height - 8, width, height: 8, color: rgb(r, g, b) })
    page.drawText(`${deck.teamName.slice(0, 40)} · Team ${deck.teamNumber}`, {
      x: 56,
      y: height - 56,
      size: 11,
      font: fonts.regular,
      color: muted,
    })
  }

  let y = index === 0 ? height - 320 : height - 110
  const sections = SECTIONS.slice(index === 0 ? 0 : (index * 2) % SECTIONS.length).concat(SECTIONS).slice(0, 3)
  for (const [heading, paragraphs] of sections) {
    page.drawText(heading, { x: 56, y, size: 15, font: fonts.bold, color: ink })
    y -= 26
    for (const paragraph of paragraphs) {
      for (const line of wrap(paragraph, fonts.regular, 11.5, width - 112)) {
        page.drawText(line, { x: 56, y, size: 11.5, font: fonts.regular, color: muted })
        y -= 17
      }
      y -= 8
    }
    y -= 14
  }
  page.drawText(`${index + 1} / ${deck.pages}`, { x: width - 90, y: 36, size: 10, font: fonts.regular, color: muted })
}

export async function generateDeckPdf(deck: DeckContent): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${deck.teamName} sponsorship deck`)
  pdf.setAuthor(deck.teamName)
  pdf.setCreator('FTC Pitfund seed')
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  for (let i = 0; i < deck.pages; i++) {
    const page = pdf.addPage([612, 792])
    drawPage(page, i, deck, fonts)
    if ((deck.maxSize || deck.noiseSide) && i === deck.pages - 1) {
      // Random noise does not compress: ~9.8 MB of image data at 1850 px.
      const side = deck.noiseSide ?? 1850
      const noise = new Uint8Array(side * side * 3)
      for (let j = 0; j < noise.length; j += 65536) {
        crypto.getRandomValues(noise.subarray(j, Math.min(j + 65536, noise.length)))
      }
      const image = await pdf.embedPng(encodePng(side, side, noise, 1))
      page.drawImage(image, { x: 56, y: 60, width: 200, height: 200 })
    }
  }
  return pdf.save({ useObjectStreams: true })
}
