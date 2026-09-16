'use client'

import { LOGO_SIZE_PX, MAX_IMAGE_UPLOAD_BYTES, MAX_LOGO_SOURCE_BYTES } from '@/lib/shared/team'

import { encodeImage } from './upload'

/*
 * Logos end up as a 512 px square WebP (JPEG where the browser can't encode WebP), cropped in the
 * browser with a canvas and no crop library.
 *
 * Which square is up to the person: components/uploads/logo-cropper.tsx lets them drag and zoom,
 * the way Instagram does. Before that it was always the middle of the image, which quietly cut the
 * top off any logo with a wordmark under it.
 */

export class ImageCheckError extends Error {}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

/** The visible square, in source-image pixels. */
export type Crop = { x: number; y: number; size: number }

/** Validate the file and decode it. The caller closes the bitmap when it's finished with it. */
export async function loadLogoSource(file: File): Promise<ImageBitmap> {
  if (!ACCEPTED.includes(file.type)) throw new ImageCheckError('Choose a PNG, JPEG or WebP image.')
  if (file.size > MAX_LOGO_SOURCE_BYTES) throw new ImageCheckError('That image is larger than 2 MB. Choose a smaller one.')
  try {
    return await createImageBitmap(file)
  } catch {
    throw new ImageCheckError('That image couldn’t be read. Choose a different file.')
  }
}

/** The biggest centred square that fits — where the cropper starts, and the fallback if it's skipped. */
export function centeredCrop(bitmap: { width: number; height: number }): Crop {
  const size = Math.min(bitmap.width, bitmap.height)
  return { x: (bitmap.width - size) / 2, y: (bitmap.height - size) / 2, size }
}

export function renderSquareLogo(bitmap: ImageBitmap, crop: Crop, size = LOGO_SIZE_PX): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageCheckError('This browser can’t resize images. Try another browser.')
  // White underneath: a transparent PNG would otherwise go black wherever a logo is drawn in dark ink.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size)
  return encodeImage(canvas, MAX_IMAGE_UPLOAD_BYTES)
}

/** Decode, crop to the middle and encode, for callers that don't open the cropper. */
export async function squareLogo(file: File, size = LOGO_SIZE_PX): Promise<Blob> {
  const bitmap = await loadLogoSource(file)
  try {
    return await renderSquareLogo(bitmap, centeredCrop(bitmap), size)
  } finally {
    bitmap.close()
  }
}
