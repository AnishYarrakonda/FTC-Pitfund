import { describe, expect, it } from 'vitest'

import { centeredCrop } from '@/lib/client/image'
import { instagramUrl, normalizeInstagram } from '@/lib/shared/team'

/*
 * The geometry behind the logo cropper, and the Instagram handle people paste in. Both are pure
 * functions; the dragging itself is exercised in the browser by tests/e2e.
 */

describe('logo crop', () => {
  it('starts as the biggest centred square that fits', () => {
    // Wide: the square is the full height, centred horizontally.
    expect(centeredCrop({ width: 1200, height: 500 })).toEqual({ x: 350, y: 0, size: 500 })
    // Tall: the full width, centred vertically.
    expect(centeredCrop({ width: 400, height: 1000 })).toEqual({ x: 0, y: 300, size: 400 })
    // Already square: the whole thing.
    expect(centeredCrop({ width: 512, height: 512 })).toEqual({ x: 0, y: 0, size: 512 })
  })
})

describe('instagram handles', () => {
  it('accepts whatever people paste and stores the bare handle', () => {
    for (const input of [
      'exodiusftc',
      '@exodiusftc',
      '  @exodiusftc  ',
      'instagram.com/exodiusftc',
      'https://instagram.com/exodiusftc',
      'https://www.instagram.com/exodiusftc/',
      'https://www.instagram.com/exodiusftc?hl=en',
    ]) {
      expect(normalizeInstagram(input)).toBe('exodiusftc')
    }
    expect(normalizeInstagram('team.exodius_1')).toBe('team.exodius_1')
    expect(instagramUrl('exodiusftc')).toBe('https://instagram.com/exodiusftc')
  })

  it('treats an empty box as "no handle" and anything unusable as a mistake', () => {
    // null means "they left it blank", undefined means "that isn't a handle" — the form shows an
    // error for the second and saves nothing for the first.
    expect(normalizeInstagram('')).toBeNull()
    expect(normalizeInstagram('   ')).toBeNull()
    for (const bad of ['not a handle', 'exodius ftc', 'https://example.com/exodius', 'a'.repeat(31), '@@exodius', 'exodius!']) {
      expect(normalizeInstagram(bad)).toBeUndefined()
    }
  })
})
