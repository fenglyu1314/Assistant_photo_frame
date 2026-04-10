import { describe, it, expect } from 'vitest'
import {
  colorDistanceSq,
  nearestPaletteIndex,
  nearestPaletteIndexWithDist,
  quantizeNearest,
  quantizeFloydSteinberg,
  enhanceSaturation,
  preprocessGrayPixels,
  DITHER_THRESHOLD_SQ,
  GRAY_SPREAD_THRESHOLD,
  GRAY_LUMINANCE_MIDPOINT,
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
// nearestPaletteIndexWithDist
// ===========================================================================

describe('nearestPaletteIndexWithDist', () => {
  it('returns distSq=0 for pure BLACK', () => {
    const result = nearestPaletteIndexWithDist(0, 0, 0)
    expect(result.palIdx).toBe(0)
    expect(result.distSq).toBe(0)
  })

  it('returns distSq=0 for pure WHITE', () => {
    const result = nearestPaletteIndexWithDist(255, 255, 255)
    expect(result.palIdx).toBe(1)
    expect(result.distSq).toBe(0)
  })

  it('returns distSq=0 for pure RED', () => {
    const result = nearestPaletteIndexWithDist(255, 0, 0)
    expect(result.palIdx).toBe(3)
    expect(result.distSq).toBe(0)
  })

  it('returns correct distSq for near-black (20,20,20)', () => {
    const result = nearestPaletteIndexWithDist(20, 20, 20)
    expect(result.palIdx).toBe(0) // BLACK
    expect(result.distSq).toBe(20 * 20 + 20 * 20 + 20 * 20) // 1200
  })

  it('is consistent with nearestPaletteIndex', () => {
    const testColors = [
      [0, 0, 0], [255, 255, 255], [128, 128, 128],
      [200, 50, 30], [10, 200, 100], [50, 50, 200],
    ]
    for (const [r, g, b] of testColors) {
      const idx = nearestPaletteIndex(r, g, b)
      const result = nearestPaletteIndexWithDist(r, g, b)
      expect(result.palIdx).toBe(idx)
    }
  })
})

// ===========================================================================
// DITHER_THRESHOLD_SQ constant
// ===========================================================================

describe('DITHER_THRESHOLD_SQ', () => {
  it('is exported and equals 24000', () => {
    expect(DITHER_THRESHOLD_SQ).toBe(24000)
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

  // --- Threshold protection tests ---

  it('maps near-black (20,20,20) to all BLACK(0) — no colored artifacts', () => {
    const rgba = solidRGBA(8, 8, 20, 20, 20)
    const result = quantizeFloydSteinberg(rgba, 8, 8)
    for (const v of result) {
      expect(v).toBe(0) // BLACK — threshold protection prevents error diffusion
    }
  })

  it('maps near-white (240,240,240) to all WHITE(1) — no colored artifacts', () => {
    const rgba = solidRGBA(8, 8, 240, 240, 240)
    const result = quantizeFloydSteinberg(rgba, 8, 8)
    for (const v of result) {
      expect(v).toBe(1) // WHITE — threshold protection prevents error diffusion
    }
  })

  it('mid-gray (128,128,128) still dithers normally despite threshold', () => {
    // 128,128,128 → distSq to WHITE = 48387 >> 24000, should NOT be skipped
    const rgba = solidRGBA(16, 16, 128, 128, 128)
    const result = quantizeFloydSteinberg(rgba, 16, 16)

    const uniqueColors = new Set<number>()
    for (const v of result) {
      uniqueColors.add(v)
    }
    // Must have at least 2 distinct colors → normal dithering still works
    expect(uniqueColors.size).toBeGreaterThanOrEqual(2)
  })
})

// ===========================================================================
// preprocessGrayPixels
// ===========================================================================

describe('preprocessGrayPixels', () => {
  it('exports GRAY_SPREAD_THRESHOLD = 40', () => {
    expect(GRAY_SPREAD_THRESHOLD).toBe(40)
  })

  it('exports GRAY_LUMINANCE_MIDPOINT = 128', () => {
    expect(GRAY_LUMINANCE_MIDPOINT).toBe(128)
  })

  it('binarizes dark gray (50,50,50) to BLACK (0,0,0)', () => {
    const rgba = solidRGBA(1, 1, 50, 50, 50)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(0)
    expect(rgba[1]).toBe(0)
    expect(rgba[2]).toBe(0)
  })

  it('binarizes light gray (200,200,200) to WHITE (255,255,255)', () => {
    const rgba = solidRGBA(1, 1, 200, 200, 200)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(255)
  })

  it('binarizes AA gray (80,80,80) to BLACK — simulates text edge', () => {
    const rgba = solidRGBA(1, 1, 80, 80, 80)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(0)
    expect(rgba[1]).toBe(0)
    expect(rgba[2]).toBe(0)
  })

  it('binarizes AA gray (180,180,180) to WHITE — simulates text edge', () => {
    const rgba = solidRGBA(1, 1, 180, 180, 180)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(255)
  })

  it('leaves pure BLACK unchanged', () => {
    const rgba = solidRGBA(1, 1, 0, 0, 0)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(0)
    expect(rgba[1]).toBe(0)
    expect(rgba[2]).toBe(0)
  })

  it('leaves pure WHITE unchanged', () => {
    const rgba = solidRGBA(1, 1, 255, 255, 255)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(255)
  })

  it('leaves chromatic pixels unchanged — pure RED', () => {
    const rgba = solidRGBA(1, 1, 255, 0, 0)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(0)
    expect(rgba[2]).toBe(0)
  })

  it('leaves chromatic pixels unchanged — saturated color', () => {
    const rgba = solidRGBA(1, 1, 200, 50, 30)
    preprocessGrayPixels(rgba, 1, 1)
    // spread = 200 - 30 = 170 >> 40, so not touched
    expect(rgba[0]).toBe(200)
    expect(rgba[1]).toBe(50)
    expect(rgba[2]).toBe(30)
  })

  it('handles near-gray with slight tint within threshold', () => {
    // (120, 130, 140) → spread = 20 ≤ 40, avg = 130 → WHITE
    const rgba = solidRGBA(1, 1, 120, 130, 140)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(255)
  })

  it('does NOT binarize when spread > GRAY_SPREAD_THRESHOLD', () => {
    // (100, 100, 150) → spread = 50 > 40, not touched
    const rgba = solidRGBA(1, 1, 100, 100, 150)
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[0]).toBe(100)
    expect(rgba[1]).toBe(100)
    expect(rgba[2]).toBe(150)
  })

  it('preserves alpha channel', () => {
    const rgba = new Uint8Array([80, 80, 80, 128])
    preprocessGrayPixels(rgba, 1, 1)
    expect(rgba[3]).toBe(128) // alpha untouched
  })

  it('works on multi-pixel images — mixed gray and chromatic', () => {
    const rgba = new Uint8Array([
      50, 50, 50, 255,       // gray → BLACK
      200, 200, 200, 255,    // gray → WHITE
      255, 0, 0, 255,        // RED → unchanged
      100, 100, 100, 255,    // gray → BLACK (avg=100 < 128)
    ])
    preprocessGrayPixels(rgba, 2, 2)

    // Pixel 0: BLACK
    expect(rgba[0]).toBe(0); expect(rgba[1]).toBe(0); expect(rgba[2]).toBe(0)
    // Pixel 1: WHITE
    expect(rgba[4]).toBe(255); expect(rgba[5]).toBe(255); expect(rgba[6]).toBe(255)
    // Pixel 2: RED (unchanged)
    expect(rgba[8]).toBe(255); expect(rgba[9]).toBe(0); expect(rgba[10]).toBe(0)
    // Pixel 3: BLACK
    expect(rgba[12]).toBe(0); expect(rgba[13]).toBe(0); expect(rgba[14]).toBe(0)
  })

  it('returns the same Uint8Array reference (in-place modification)', () => {
    const rgba = solidRGBA(2, 2, 100, 100, 100)
    const result = preprocessGrayPixels(rgba, 2, 2)
    expect(result).toBe(rgba) // same reference
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

// ===========================================================================
// Optional parameter extensions (Task 8.4)
// ===========================================================================

describe('quantizeFloydSteinberg — optional ditherThreshold', () => {
  it('without threshold parameter, behaves identically to default', () => {
    const rgba = solidRGBA(4, 4, 100, 80, 60)
    const resultNoArg = quantizeFloydSteinberg(rgba.slice(), 4, 4)
    const resultDefault = quantizeFloydSteinberg(rgba.slice(), 4, 4, DITHER_THRESHOLD_SQ)
    expect(Array.from(resultNoArg)).toEqual(Array.from(resultDefault))
  })

  it('threshold=0 disables dither bypass — all pixels diffuse error', () => {
    // A mid-gray that normally sits within the dither threshold for WHITE/BLACK
    // With threshold=0, every pixel should diffuse errors
    const rgba = solidRGBA(4, 4, 100, 80, 60)
    const resultDefault = quantizeFloydSteinberg(rgba.slice(), 4, 4)
    const resultNoDither = quantizeFloydSteinberg(rgba.slice(), 4, 4, 0)
    // They may or may not differ depending on pixel values, but the function should
    // accept the parameter without error
    expect(resultNoDither).toHaveLength(16)
    // With threshold=0, more error diffusion happens, which MAY produce different results
    // (depending on input). The key contract: it runs without error and returns valid indices.
    for (let i = 0; i < 16; i++) {
      const idx = resultNoDither[i]
      // All indices should be valid palette entries (0,1,2,3,5,6 — not 4)
      expect([0, 1, 2, 3, 5, 6]).toContain(idx)
    }
  })

  it('high threshold approaches nearest-neighbor behavior', () => {
    const rgba = solidRGBA(2, 2, 200, 50, 50)
    const resultHigh = quantizeFloydSteinberg(rgba.slice(), 2, 2, 999999)
    const nearest = quantizeNearest(rgba, 2, 2)
    // With extremely high threshold, all pixels skip error diffusion → same as nearest
    expect(Array.from(resultHigh)).toEqual(Array.from(nearest))
  })
})

describe('preprocessGrayPixels — optional graySpread and grayLuminanceMidpoint', () => {
  it('without optional params, behaves identically to default', () => {
    const rgba1 = solidRGBA(2, 2, 80, 80, 80)
    const rgba2 = solidRGBA(2, 2, 80, 80, 80)
    preprocessGrayPixels(rgba1, 2, 2)
    preprocessGrayPixels(rgba2, 2, 2, GRAY_SPREAD_THRESHOLD, GRAY_LUMINANCE_MIDPOINT)
    expect(Array.from(rgba1)).toEqual(Array.from(rgba2))
  })

  it('graySpread=80 treats wider spread pixels as gray', () => {
    // (100, 100, 150) → spread=50, default threshold=40 → NOT gray
    // With graySpread=80 → spread ≤ 80 → IS gray, avg=116.7 < 128 → BLACK
    const rgba = solidRGBA(1, 1, 100, 100, 150)
    preprocessGrayPixels(rgba, 1, 1, 80, 128)
    expect(rgba[0]).toBe(0)
    expect(rgba[1]).toBe(0)
    expect(rgba[2]).toBe(0)
  })

  it('graySpread=0 only binarizes perfectly achromatic pixels', () => {
    // (80, 80, 80) → spread=0 ≤ 0 → gray → avg=80 < 128 → BLACK
    const rgba1 = solidRGBA(1, 1, 80, 80, 80)
    preprocessGrayPixels(rgba1, 1, 1, 0, 128)
    expect(rgba1[0]).toBe(0)

    // (80, 80, 81) → spread=1 > 0 → NOT gray → unchanged
    const rgba2 = new Uint8Array([80, 80, 81, 255])
    preprocessGrayPixels(rgba2, 1, 1, 0, 128)
    expect(rgba2[0]).toBe(80)
    expect(rgba2[1]).toBe(80)
    expect(rgba2[2]).toBe(81)
  })

  it('custom grayLuminanceMidpoint changes binarization split', () => {
    // (80, 80, 80) → avg=80
    // Default midpoint=128 → 80 < 128 → BLACK
    // Custom midpoint=60 → 80 >= 60 → WHITE
    const rgba = solidRGBA(1, 1, 80, 80, 80)
    preprocessGrayPixels(rgba, 1, 1, 40, 60)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(255)
  })
})
