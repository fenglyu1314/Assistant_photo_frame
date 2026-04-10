import { describe, it, expect } from 'vitest'
import { indicesToRgba, computeColorStats } from '../quantized-preview'
import { EPD_PALETTE } from '../palette'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Create a solid palette-index array filled with a single index value.
 */
function solidIndices(w: number, h: number, palIdx: number): Uint8Array {
  const arr = new Uint8Array(w * h)
  arr.fill(palIdx)
  return arr
}

// ---------------------------------------------------------------------------
// indicesToRgba
// ---------------------------------------------------------------------------

describe('indicesToRgba', () => {
  it('should return RGBA buffer with correct length', () => {
    const indices = solidIndices(10, 20, 0) // BLACK
    const rgba = indicesToRgba(indices, 10, 20)
    expect(rgba.length).toBe(10 * 20 * 4)
  })

  it('should correctly map BLACK (index 0) to [0, 0, 0, 255]', () => {
    const indices = solidIndices(2, 2, 0)
    const rgba = indicesToRgba(indices, 2, 2)
    for (let i = 0; i < 4; i++) {
      const off = i * 4
      expect(rgba[off]).toBe(0)     // R
      expect(rgba[off + 1]).toBe(0) // G
      expect(rgba[off + 2]).toBe(0) // B
      expect(rgba[off + 3]).toBe(255) // A
    }
  })

  it('should correctly map WHITE (index 1) to [255, 255, 255, 255]', () => {
    const indices = solidIndices(2, 2, 1)
    const rgba = indicesToRgba(indices, 2, 2)
    for (let i = 0; i < 4; i++) {
      const off = i * 4
      expect(rgba[off]).toBe(255)
      expect(rgba[off + 1]).toBe(255)
      expect(rgba[off + 2]).toBe(255)
      expect(rgba[off + 3]).toBe(255)
    }
  })

  it('should correctly map YELLOW (index 2) to [255, 255, 0, 255]', () => {
    const indices = solidIndices(1, 1, 2)
    const rgba = indicesToRgba(indices, 1, 1)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(0)
    expect(rgba[3]).toBe(255)
  })

  it('should correctly map RED (index 3) to [255, 0, 0, 255]', () => {
    const indices = solidIndices(1, 1, 3)
    const rgba = indicesToRgba(indices, 1, 1)
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(0)
    expect(rgba[2]).toBe(0)
    expect(rgba[3]).toBe(255)
  })

  it('should correctly map BLUE (index 5) to [0, 0, 255, 255]', () => {
    const indices = solidIndices(1, 1, 5)
    const rgba = indicesToRgba(indices, 1, 1)
    expect(rgba[0]).toBe(0)
    expect(rgba[1]).toBe(0)
    expect(rgba[2]).toBe(255)
    expect(rgba[3]).toBe(255)
  })

  it('should correctly map GREEN (index 6) to [0, 255, 0, 255]', () => {
    const indices = solidIndices(1, 1, 6)
    const rgba = indicesToRgba(indices, 1, 1)
    expect(rgba[0]).toBe(0)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(0)
    expect(rgba[3]).toBe(255)
  })

  it('should map all 6 valid colors correctly in a mixed image', () => {
    // 6-pixel image, one of each color
    const indices = new Uint8Array([0, 1, 2, 3, 5, 6])
    const rgba = indicesToRgba(indices, 6, 1)

    const expected: [number, number, number][] = [
      [0, 0, 0],       // BLACK
      [255, 255, 255], // WHITE
      [255, 255, 0],   // YELLOW
      [255, 0, 0],     // RED
      [0, 0, 255],     // BLUE
      [0, 255, 0],     // GREEN
    ]

    for (let i = 0; i < 6; i++) {
      const off = i * 4
      const [er, eg, eb] = expected[i]
      expect(rgba[off]).toBe(er)
      expect(rgba[off + 1]).toBe(eg)
      expect(rgba[off + 2]).toBe(eb)
      expect(rgba[off + 3]).toBe(255)
    }
  })

  it('should render invalid index 4 as magenta fallback', () => {
    const indices = new Uint8Array([4])
    const rgba = indicesToRgba(indices, 1, 1)
    expect(rgba[0]).toBe(255) // R
    expect(rgba[1]).toBe(0)   // G
    expect(rgba[2]).toBe(255) // B
    expect(rgba[3]).toBe(255) // A
  })

  it('should throw if indices length does not match width × height', () => {
    const indices = new Uint8Array(10)
    expect(() => indicesToRgba(indices, 5, 5)).toThrow('does not match')
  })

  it('should handle a large image (EPD full size)', () => {
    const w = 480
    const h = 800
    const indices = solidIndices(w, h, 1) // all WHITE
    const rgba = indicesToRgba(indices, w, h)
    expect(rgba.length).toBe(w * h * 4)
    // Spot-check first and last pixel
    expect(rgba[0]).toBe(255)
    expect(rgba[1]).toBe(255)
    expect(rgba[2]).toBe(255)
    expect(rgba[3]).toBe(255)
    const lastOff = (w * h - 1) * 4
    expect(rgba[lastOff]).toBe(255)
    expect(rgba[lastOff + 1]).toBe(255)
    expect(rgba[lastOff + 2]).toBe(255)
    expect(rgba[lastOff + 3]).toBe(255)
  })
})

// ---------------------------------------------------------------------------
// computeColorStats
// ---------------------------------------------------------------------------

describe('computeColorStats', () => {
  it('should return 6 entries for all valid palette indices', () => {
    const indices = solidIndices(10, 10, 0)
    const stats = computeColorStats(indices)
    expect(stats.length).toBe(6)
    // All valid indices should be present
    const idxes = stats.map((s) => s.index)
    expect(idxes).toEqual([0, 1, 2, 3, 5, 6])
  })

  it('should compute 100% for a solid-color image', () => {
    const indices = solidIndices(10, 10, 3) // all RED
    const stats = computeColorStats(indices)
    const red = stats.find((s) => s.index === 3)!
    expect(red.count).toBe(100)
    expect(red.percent).toBe(100)
    expect(red.name).toBe('RED')

    // All other colors should be 0
    for (const s of stats) {
      if (s.index !== 3) {
        expect(s.count).toBe(0)
        expect(s.percent).toBe(0)
      }
    }
  })

  it('should compute correct percentages for a mixed image', () => {
    // 10 pixels: 5 BLACK, 3 WHITE, 2 BLUE
    const indices = new Uint8Array([0, 0, 0, 0, 0, 1, 1, 1, 5, 5])
    const stats = computeColorStats(indices)

    const black = stats.find((s) => s.index === 0)!
    expect(black.count).toBe(5)
    expect(black.percent).toBe(50)

    const white = stats.find((s) => s.index === 1)!
    expect(white.count).toBe(3)
    expect(white.percent).toBe(30)

    const blue = stats.find((s) => s.index === 5)!
    expect(blue.count).toBe(2)
    expect(blue.percent).toBe(20)
  })

  it('should handle empty indices array', () => {
    const indices = new Uint8Array(0)
    const stats = computeColorStats(indices)
    expect(stats.length).toBe(6)
    for (const s of stats) {
      expect(s.count).toBe(0)
      expect(s.percent).toBe(0)
    }
  })

  it('should have correct color names', () => {
    const indices = solidIndices(1, 1, 0)
    const stats = computeColorStats(indices)
    const nameMap: Record<number, string> = {
      0: 'BLACK',
      1: 'WHITE',
      2: 'YELLOW',
      3: 'RED',
      5: 'BLUE',
      6: 'GREEN',
    }
    for (const s of stats) {
      expect(s.name).toBe(nameMap[s.index])
    }
  })

  it('should compute percentages with correct rounding', () => {
    // 3 pixels: 1 each of BLACK, WHITE, RED → 33.33% each
    const indices = new Uint8Array([0, 1, 3])
    const stats = computeColorStats(indices)

    const black = stats.find((s) => s.index === 0)!
    expect(black.percent).toBe(33.33)

    const white = stats.find((s) => s.index === 1)!
    expect(white.percent).toBe(33.33)

    const red = stats.find((s) => s.index === 3)!
    expect(red.percent).toBe(33.33)
  })

  it('should ignore invalid index 4 in counting', () => {
    // Index 4 should not contribute to any valid color count
    const indices = new Uint8Array([0, 4, 1])
    const stats = computeColorStats(indices)

    const black = stats.find((s) => s.index === 0)!
    expect(black.count).toBe(1)

    const white = stats.find((s) => s.index === 1)!
    expect(white.count).toBe(1)

    // Total accounted = 2 out of 3 (index 4 is not in valid set)
    const totalCounted = stats.reduce((sum, s) => sum + s.count, 0)
    expect(totalCounted).toBe(2)
  })
})
