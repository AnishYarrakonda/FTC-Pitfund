'use client'

import { useCallback, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { centeredCrop, renderSquareLogo, type Crop } from '@/lib/client/image'

/*
 * Pick which square of the image becomes the logo, by dragging it under a fixed window and zooming
 * — the way cropping a profile picture works everywhere else, so nobody has to be taught it.
 *
 * The maths is all in source-image pixels: `scale` is how many source pixels fit across the window,
 * and (x, y) is the top-left of the visible square. Keeping it in source space means the result is
 * exact regardless of how big the preview happens to be rendered.
 */

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const STEP = 0.1
/** How far the arrow keys nudge, as a fraction of the visible square. */
const NUDGE = 0.04

type Props = {
  bitmap: ImageBitmap
  /** An object URL for the same image; the preview is a plain <img> so the browser does the scaling. */
  previewUrl: string
  onCancel: () => void
  onCropped: (blob: Blob) => void
}

export default function LogoCropperImpl({ bitmap, previewUrl, onCancel, onCropped }: Props) {
  const base = centeredCrop(bitmap)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [centre, setCentre] = useState({ x: bitmap.width / 2, y: bitmap.height / 2 })
  const [working, setWorking] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)

  const size = base.size / zoom

  /** Keep the visible square inside the image, so it can never show empty space. */
  const clamp = useCallback(
    (next: { x: number; y: number }, visible: number) => ({
      x: Math.min(Math.max(next.x, visible / 2), bitmap.width - visible / 2),
      y: Math.min(Math.max(next.y, visible / 2), bitmap.height - visible / 2),
    }),
    [bitmap.height, bitmap.width],
  )

  /** Zooming out grows the visible square, which can push it past an edge: re-clamp as we go. */
  const changeZoom = useCallback(
    (next: number) => {
      const level = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(2))))
      setZoom(level)
      setCentre((c) => clamp(c, base.size / level))
    },
    [base.size, clamp],
  )

  const crop: Crop = { x: centre.x - size / 2, y: centre.y - size / 2, size }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (working) return
    // Capture keeps the drag alive when the finger leaves the square. It throws if the pointer has
    // already gone (and for synthetic events in tests), which must not stop the drag from starting.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Dragging still works without capture, it just stops at the edge of the element.
    }
    drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: centre.x, originY: centre.y }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const frame = frameRef.current
    if (!d || d.pointerId !== e.pointerId || !frame) return
    // Source pixels per CSS pixel, so the image tracks the finger exactly.
    const perPixel = size / frame.getBoundingClientRect().width
    setCentre(clamp({ x: d.originX - (e.clientX - d.startX) * perPixel, y: d.originY - (e.clientY - d.startY) * perPixel }, size))
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = size * NUDGE
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[e.key]
    if (move) {
      e.preventDefault()
      setCentre((c) => clamp({ x: c.x + move[0], y: c.y + move[1] }, size))
      return
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      changeZoom(zoom + STEP)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      changeZoom(zoom - STEP)
    }
  }

  const apply = async () => {
    setWorking(true)
    try {
      onCropped(await renderSquareLogo(bitmap, crop))
    } finally {
      setWorking(false)
    }
  }

  // The image is positioned so that `crop` is exactly what shows through the square frame.
  const scalePercent = (bitmap.width / size) * 100
  const leftPercent = (-crop.x / size) * 100
  const topPercent = (-crop.y / size) * 100

  return (
    <Dialog open onOpenChange={(next) => !next && !working && onCancel()}>
      <DialogContent
        size="sm"
        title="Position your logo"
        description="Drag the image to move it and use the slider to zoom. What you see in the square is what companies see."
        dismissible={!working}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary" disabled={working}>
                Cancel
              </Button>
            </DialogClose>
            <Button data-action-button="" loading={working} loadingLabel="Saving…" onClick={() => void apply()}>
              Use photo
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div
            ref={frameRef}
            role="application"
            aria-label="Crop area. Drag to move the image, or use the arrow keys. Press plus and minus to zoom."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className="relative aspect-square w-full max-w-full cursor-grab touch-none overflow-hidden rounded-dialog bg-muted select-none active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, nothing to optimize */}
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              className="pointer-events-none absolute origin-top-left"
              style={{ width: `${scalePercent}%`, left: `${leftPercent}%`, top: `${topPercent}%`, maxWidth: 'none' }}
            />
          </div>
          <label className="grid gap-1.5">
            <span className="text-small font-medium text-text">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={STEP}
              value={zoom}
              disabled={working}
              onChange={(e) => changeZoom(Number(e.target.value))}
              className="h-8 w-full accent-[var(--color-accent)]"
            />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  )
}
