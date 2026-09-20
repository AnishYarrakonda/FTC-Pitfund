import { GLOBE_PTS } from './world-points'
import { type Cleanup, fitCanvas, loopWhileVisible, rng } from './util'

/*
 * Three 2D canvases: the dotted globe (bento "public page" card), the twisting line ribbons (bento
 * "match" card and the navy section), and the sunburst over the stats sky.
 */

export function initGlobes(root: HTMLElement): Cleanup {
  const stops = [...root.querySelectorAll<HTMLCanvasElement>('[data-hp-globe]')].map((c) => {
    const ctx = c.getContext('2d')!
    
    // Convert a lat/lon to 3D Cartesian coordinates
    const to3D = (lat: number, lon: number) => {
      const la = (lat * Math.PI) / 180
      const lo = (lon * Math.PI) / 180
      return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
    }

    const ROUTES = [
      { t: to3D(30.26, -97.74), s: to3D(47.60, -122.33), tLab: 'EX', sLab: 'BB' },
      { t: to3D(51.5, -0.1), s: to3D(40.7, -74.0), tLab: 'SS', sLab: 'GV' },
      { t: to3D(35.6, 139.6), s: to3D(-33.8, 151.2), tLab: 'NN', sLab: 'CR' },
      { t: to3D(52.5, 13.4), s: to3D(-33.9, 18.4), tLab: 'PP', sLab: 'MZ' },
      { t: to3D(43.7, -79.3), s: to3D(37.7, -122.4), tLab: 'RR', sLab: 'VN' },
      { t: to3D(1.3, 103.8), s: to3D(12.9, 77.5), tLab: 'CC', sLab: 'PT' },
      { t: to3D(48.8, 2.3), s: to3D(25.2, 55.2), tLab: 'HH', sLab: 'SX' },
      { t: to3D(-23.5, -46.6), s: to3D(19.4, -99.1), tLab: 'MB', sLab: 'NZ' }
    ]

    // Create a bezier curve between the two points for the arc
    return loopWhileVisible(c, (t) => {
      const [w, h, dpr] = fitCanvas(c)
      ctx.clearRect(0, 0, w, h)
      const R = Math.min(w, h) * 0.52
      const cx = w * 0.55
      const cy = h * 0.68
      const a = t * 0.2 // speed up a bit
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      
      const tilt = -0.35
      const ct = Math.cos(tilt)
      const st = Math.sin(tilt)

      const project = (x: number, y: number, z: number) => {
        const X = x * ca + z * sa
        const Z0 = -x * sa + z * ca
        const Y = y * ct - Z0 * st
        const Z = y * st + Z0 * ct
        return { X, Y, Z }
      }

      ctx.fillStyle = '#1e40af' // dots color
      for (const [x, y, z] of GLOBE_PTS) {
        const { X, Y, Z } = project(x, y, z)
        if (Z < -0.1) continue
        ctx.globalAlpha = 0.15 + 0.75 * Math.max(0, Z)
        ctx.fillRect(cx + X * R, cy - Y * R, 1.8 * dpr, 1.8 * dpr)
      }
      
      // Draw Arcs
      for (const route of ROUTES) {
        const p1 = project(route.t[0], route.t[1], route.t[2])
        const p2 = project(route.s[0], route.s[1], route.s[2])
        
        if (p1.Z > -0.2 && p2.Z > -0.2) {
          ctx.globalAlpha = Math.min(1, Math.max(0, (p1.Z + p2.Z) + 0.5))
          ctx.beginPath()
          ctx.moveTo(cx + p1.X * R, cy - p1.Y * R)
          const midX = (p1.X + p2.X) / 2
          const midY = (p1.Y + p2.Y) / 2
          const cX = cx + midX * R
          const cY = cy - midY * R - (R * 0.3)
          
          ctx.quadraticCurveTo(cX, cY, cx + p2.X * R, cy - p2.Y * R)
          ctx.strokeStyle = '#eab308'
          ctx.lineWidth = 1.5 * dpr
          ctx.setLineDash([4 * dpr, 4 * dpr])
          ctx.lineDashOffset = -t * 20
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      // Draw pins
      const drawPin = (p: ReturnType<typeof project>, color: string, initials: string) => {
        if (p.Z < -0.1) return
        ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, p.Z)
        
        const px = cx + p.X * R
        const py = cy - p.Y * R
        
        // Dot marker on the ground
        ctx.beginPath()
        ctx.arc(px, py, 3 * dpr, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        
        // Draw the avatar circle next to it
        const ax = px + 14 * dpr
        const ay = py - 14 * dpr
        const ar = 12 * dpr
        
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(ax, ay)
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5 * dpr
        ctx.setLineDash([])
        ctx.globalAlpha = 0.5 * (0.3 + 0.7 * Math.max(0, p.Z))
        ctx.stroke()
        
        ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, p.Z)
        ctx.beginPath()
        ctx.arc(ax, ay, ar, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.shadowColor = 'rgba(0,0,0,0.15)'
        ctx.shadowBlur = 6 * dpr
        ctx.shadowOffsetY = 2 * dpr
        ctx.fill()
        
        ctx.lineWidth = 2 * dpr
        ctx.strokeStyle = '#fff'
        ctx.shadowColor = 'transparent'
        ctx.stroke()
        
        ctx.font = `600 ${9 * dpr}px Inter, sans-serif`
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(initials, ax, ay + 1 * dpr)
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'
      }

      for (const route of ROUTES) {
        const p1 = project(route.t[0], route.t[1], route.t[2])
        const p2 = project(route.s[0], route.s[1], route.s[2])
        drawPin(p1, '#1e40af', route.tLab)
        drawPin(p2, '#10b981', route.sLab)
      }

      ctx.globalAlpha = 1
    })
  })
  return () => stops.forEach((s) => s())
}
const LINE_PALETTES: Record<string, string[]> = {
  warm: ['#fef08a', '#eab308', '#eab308', '#3b82f6', '#1e40af'],
  cool: ['#d9f99d', '#10b981', '#0ea5e9', '#3b82f6', '#1e40af'],
}

export function initLines(root: HTMLElement): Cleanup {
  const stops = [...root.querySelectorAll<HTMLCanvasElement>('[data-hp-lines]')].map((c) => {
    const ctx = c.getContext('2d')!
    const pal = LINE_PALETTES[c.dataset.hpLines ?? 'warm'] ?? LINE_PALETTES.warm
    const dark = c.dataset.hpLines === 'cool'
    return loopWhileVisible(c, (t) => {
      const [w, h, dpr] = fitCanvas(c)
      ctx.clearRect(0, 0, w, h)
      const N = dark ? 44 : 60
      const grad = ctx.createLinearGradient(0, 0, w, 0)
      pal.forEach((col, i) => grad.addColorStop(i / (pal.length - 1), col))
      ctx.strokeStyle = grad
      ctx.lineWidth = 1 * dpr
      for (let i = 0; i < N; i++) {
        const k = i / (N - 1) - 0.5
        ctx.globalAlpha = dark ? 0.6 : 0.45
        ctx.beginPath()
        for (let x = 0; x <= w; x += 8 * dpr) {
          const u = x / w
          const env = dark ? Math.sin(Math.PI * Math.min(1, u * 1.15)) : 0.6 + 0.4 * u
          const spread = Math.cos(u * 3.4 + t * 0.35 + (dark ? 0 : 1.4)) * h * (dark ? 0.9 : 1.1) * env
          const y = h * (dark ? 0.55 : 0.5) + Math.sin(u * 2.3 + t * 0.25) * h * 0.18 - (dark ? u * h * 0.2 : 0) + k * spread
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    })
  })
  return () => stops.forEach((s) => s())
}

const BURST: Record<string, [string, string]> = {
  'pre-dawn': ['#486ffd', '#c489ff'],
  sunrise: ['#93c5fd', '#6ee7b7'],
  daytime: ['#0071c1', '#60a8e2'],
  dusk: ['#ffb451', '#60a8e2'],
  sunset: ['#ffa577', '#34d399'],
  night: ['#afffea', '#0ea5e9'],
}

export function initBurst(root: HTMLElement, getTime: () => string, getActive: () => number): Cleanup {
  const c = root.querySelector<HTMLCanvasElement>('[data-hp-burst]')
  if (!c) return () => {}
  const ctx = c.getContext('2d')!
  const r = rng(11)
  const rays = Array.from({ length: 220 }, () => ({
    a: Math.PI * (0.04 + r() * 0.92),
    len: 0.25 + Math.pow(r(), 0.7) * 0.75,
    ph: r() * 6.28,
    sp: 0.4 + r() * 0.8,
    g: Math.floor(r() * 4),
  }))
  let lens = rays.map((ray) => ray.len)
  return loopWhileVisible(c, (t) => {
    const [w, h, dpr] = fitCanvas(c)
    ctx.clearRect(0, 0, w, h)
    const [c1, c2] = BURST[getTime()] ?? BURST.daytime
    const active = getActive()
    const cx = w / 2
    const cy = h * 1.02
    const R = Math.min(w * 0.36, h * 0.95)
    lens = lens.map((l, i) => l + ((rays[i].g === active ? Math.min(1, rays[i].len * 1.25) : rays[i].len * 0.85) - l) * 0.06)
    rays.forEach((ray, i) => {
      const a = ray.a + Math.sin(t * ray.sp + ray.ph) * 0.015
      const L = R * lens[i]
      const x = cx - Math.cos(a) * L
      const y = cy - Math.sin(a) * L
      const g = ctx.createLinearGradient(cx, cy, x, y)
      g.addColorStop(0, c1 + '00')
      g.addColorStop(1, c2)
      ctx.strokeStyle = g
      ctx.globalAlpha = ray.g === active ? 0.75 : 0.35
      ctx.lineWidth = dpr * 0.8
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(x, y)
      ctx.stroke()
      ctx.fillStyle = c2
      ctx.globalAlpha = ray.g === active ? 1 : 0.55
      ctx.beginPath()
      ctx.arc(x, y, 1.6 * dpr, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.globalAlpha = 1
  })
}
