'use client'

import { LOGO_SIZE_PX, MAX_IMAGE_UPLOAD_BYTES, MAX_LOGO_SOURCE_BYTES } from '@/lib/shared/team'

import { encodeImage } from './upload'

/*
 * Logos are cropped to a centered square and resized to 512 px in the browser (canvas, no crop
 * library), then encoded as WebP (JPEG where the browser can't encode WebP).
 */

export class ImageCheckError extends Error {}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

export async function squareLogo(file: File, size = LOGO_SIZE_PX): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new ImageCheckError('Choose a PNG, JPEG or WebP image.')
  if (file.size > MAX_LOGO_SOURCE_BYTES) throw new ImageCheckError('That image is larger than 2 MB. Choose a smaller one.')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageCheckError('That image couldn’t be read. Choose a different file.')
  }
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageCheckError('This browser can’t resize images. Try another browser.')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close()
  return encodeImage(canvas, MAX_IMAGE_UPLOAD_BYTES)
}
