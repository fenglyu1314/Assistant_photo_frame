import { describe, it, expect } from 'vitest'
import {
  colorDistanceSq,
  nearestPaletteIndex,
  quantizeNearest,
  quantizeFloydSteinberg,
  enhanceSaturation,
} from '../quantizer'
import { EPD_PALETTE } from '../palette'

// ---------------------------------------------------------------------------
// Helper: create a solid RGBA image
// ---------------------------------------------------------------------------

function solidRGBA(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const data = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const off = i * 4
    data[off] = r
    data[off + 1] = g
    data[off + 2] = b
    data[off + 3] = a
  }
  return data
}

// ===========================================================================
// colorDistanceSq
// ===========================================================================

describe('colorDistanceSq', () => {
  it('returns 0 for identical colors', () => {
    expect(colorDistanceSq(100, 200, 50, 100, 200, 50)).toBe(0)
  })

  it('computes squared Euclidean distance', () => {
    // (255-0)² + (0-0)² + (0-0)² = 65025
    expect(colorDistanceSq(255, 0, 0, 0, 0, 0)).toBe(65025)
  })

  it('is symmetric', () => {
    const d1 = colorDistanceSq(10, 20, 30, 40, 50, 60)
    const d2 = colorDistanceSq(40, 50, 60, 10, 20, 30)
    expect(d1).toBe(d2)
  })
})

// ===========================================================================
// nearestPaletteIndex
// ===========================================================================

describe('nearestPaletteIndex', () => {
  it('maps pure BLACK to index 0', () => {
    expect(nearestPaletteIndex(0, 0, 0)).toBe(0)
  })

  it('maps pure WHITE to index 1', () => {
    expect(nearestPaletteIndex(255, 255, 255)).toBe(1)
  })

  it('maps pure YELLOW to index 2', () => {
    expect(nearestPaletteIndex(255, 255, 0)).toBe(2)
  })

  it('maps pure RED to index 3', () => {
    expect(nearestPaletteIndex(255, 0, 0)).toBe(3)
  })

  it('maps pure BLUE to index 5', () => {
    expect(nearestPaletteIndex(0, 0, 255)).toBe(5)
  })

  it('maps pure GREEN to index 6', () => {
    expect(nearestPaletteIndex(0, 255, 0)).toBe(6)
  })

  it('never returns index 4', () => {
    // Exhaustive check is impractical; test a range of values
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          expect(nearestPaletteIndex(r, g, b)).not.toBe(4)
        }
      }
    }
  })

  it('maps mid-gray (128,128,128) to WHITE (nearest)', () => {
    // Distance to WHITE: 3 × 127² = 48387
    // Distance to BLACK: 3 × 128² = 49152
    expect(nearestPaletteIndex(128, 128, 128)).toBe(1) // WHITE
  })
})

// ===========================================================================
// quantizeNearest
// ===========================================================================

describe('quantizeNearest', () => {
  it('maps all palette colors back to their index', () => {
    for (let i = 0; i < EPD_PALETTE.length; i++) {
      const c = EPD_PALETTE[i]
      if (c === null) continue
      const rgba = solidRGBA(1, 1, c[0], c[1], c[2])
      const result = quantizeNearest(rgba, 1, 1)
      expect(result[0]).toBe(i)
    }
  })

  it('returns correct length', () => {
    const rgba = solidRGBA(4, 3, 0, 0, 0)
    expect(quantizeNearest(rgba, 4, 3)).toHaveLength(12)
  })

  it('maps a 2×2 mixed image correctly', () => {
    // Pixel 0: RED, Pixel 1: BLUE, Pixel 2: BLACK, Pixel 3: WHITE
    const data = new Uint8Array([
      255, 0, 0, 255,     // RED → 3
      0, 0, 255, 255,     // BLUE → 5
      0, 0, 0, 255,       // BLACK → 0
      255, 255, 255, 255,  // WHITE → 1
    ])
    const result = quantizeNearest(data, 2, 2)
    expect(Array.from(result)).toEqual([3, 5, 0, 1])
  })
})

// ===========================================================================
// quantizeFloydSteinberg
// ===========================================================================

describe('quantizeFloydSteinberg', () => {
  it('maps pure white image to all WHITE(1)', () => {
    const rgba = solidRGBA(8, 8, 255, 255, 255)
    const result = quantizeFloydSteinberg(rgba, 8, 8)
    for (const v of result) {
      expect(v).toBe(1) // WHITE
    }
  })

  it('maps pure black image to all BLACK(0)', () => {
    const rgba = solidRGBA(8, 8, 0, 0, 0)
    const result = quantizeFloydSteinberg(rgba, 8, 8)
    for (const v of result) {
      expect(v).toBe(0) // BLACK
    }
  })

  it('maps pure red image to all RED(3)', () => {
    const rgba = solidRGBA(8, 8, 255, 0, 0)
    const result = quantizeFloydSteinberg(rgba, 8, 8)
    for (const v of result) {
      expect(v).toBe(3) // RED
    }
  })

  it('produces dithering pattern for mid-gray', () => {
    // 128,128,128 gray should produce a mix of BLACK and WHITE
    const rgba = solidRGBA(16, 16, 128, 128, 128)
    const result = quantizeFloydSteinberg(rgba, 16, 16)

    const counts = new Map<number, number>()
    for (const v of result) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    // Should have at least BLACK and WHITE present
    expect(counts.has(0)).toBe(true) // has BLACK
    expect(counts.has(1)).toBe(true) // has WHITE
    // Not all the same → dithering happened
    expect(counts.size).toBeGreaterThan(1)
  })

  it('returns correct length', () => {
    const rgba = solidRGBA(10, 10, 0, 0, 0)
    expect(quantizeFloydSteinberg(rgba, 10, 10)).toHaveLength(100)
  })

  it('never returns index 4', () => {
    const rgba = solidRGBA(16, 16, 128, 128, 128)
    const result = quantizeFloydSteinberg(rgba, 16, 16)
    for (const v of result) {
      expect(v).not.toBe(4)
    }
  })
})

// ===========================================================================
// enhanceSaturation
// ===========================================================================

describe('enhanceSaturation', () => {
  it('factor=1.0 returns identical pixels', () => {
    const rgba = new Uint8Array([200, 100, 50, 255, 0, 128, 255, 255])
    const result = enhanceSaturation(rgba, 2, 1, 1.0)
    // Allow ±1 for float rounding
    for (let i = 0; i < rgba.length; i++) {
      expect(Math.abs(result[i] - rgba[i])).toBeLessThanOrEqual(1)
    }
  })

  it('does not affect pure gray pixels', () => {
    const rgba = solidRGBA(2, 2, 128, 128, 128)
    const result = enhanceSaturation(rgba, 2, 2, 2.0)
    for (let i = 0; i < 4; i++) {
      const off = i * 4
      expect(Math.abs(result[off] - 128)).toBeLessThanOrEqual(1)
      expect(Math.abs(result[off + 1] - 128)).toBeLessThanOrEqual(1)
      expect(Math.abs(result[off + 2] - 128)).toBeLessThanOrEqual(1)
    }
  })

  it('does not affect pure black pixels', () => {
    const rgba = solidRGBA(1, 1, 0, 0, 0)
    const result = enhanceSaturation(rgba, 1, 1, 2.0)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
    expect(result[2]).toBe(0)
  })

  it('does not affect pure white pixels', () => {
    const rgba = solidRGBA(1, 1, 255, 255, 255)
    const result = enhanceSaturation(rgba, 1, 1, 2.0)
    expect(result[0]).toBe(255)
    expect(result[1]).toBe(255)
    expect(result[2]).toBe(255)
  })

  it('preserves alpha channel', () => {
    const rgba = new Uint8Array([200, 100, 50, 128])
    const result = enhanceSaturation(rgba, 1, 1, 1.5)
    expect(result[3]).toBe(128)
  })

  it('uses default factor of 1.4', () => {
    const rgba = new Uint8Array([200, 100, 50, 255])
    const resultDefault = enhanceSaturation(rgba, 1, 1)
    const resultExplicit = enhanceSaturation(rgba, 1, 1, 1.4)
    expect(Array.from(resultDefault)).toEqual(Array.from(resultExplicit))
  })

  it('increases saturation for colored pixels', () => {
    // A muted red — after enhancement, red channel should be higher relative to others
    const rgba = new Uint8Array([180, 120, 120, 255])
    const result = enhanceSaturation(rgba, 1, 1, 2.0)
    // R channel should increase, G/B should decrease (more saturated red)
    expect(result[0]).toBeGreaterThan(rgba[0])
    expect(result[1]).toBeLessThan(rgba[1])
  })

  it('returns correct output length', () => {
    const rgba = solidRGBA(3, 4, 100, 100, 100)
    const result = enhanceSaturation(rgba, 3, 4)
    expect(result).toHaveLength(48)  // 3 × 4 × 4
  })
})
