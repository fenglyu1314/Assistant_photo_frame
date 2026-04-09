/**
 * EPD Quantization Engine
 *
 * Converts RGBA pixel data to 6-color palette indices using:
 *   - Nearest-neighbor quantization (Euclidean distance)
 *   - Floyd-Steinberg error-diffusion dithering
 *   - HSL-based saturation enhancement
 *
 * Port of the Python img2epd.py algorithm to TypeScript with TypedArray
 * performance optimizations.
 */

import { EPD_PALETTE, type RGB } from './palette'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a lookup of valid (non-null) palette entries for fast iteration.
 * Each entry: [paletteIndex, r, g, b]
 */
const VALID_COLORS: ReadonlyArray<[index: number, r: number, g: number, b: number]> =
  EPD_PALETTE
    .map((c, i) => (c !== null ? ([i, c[0], c[1], c[2]] as [number, number, number, number]) : null))
    .filter((v): v is [number, number, number, number] => v !== null)

// ---------------------------------------------------------------------------
// Color distance
// ---------------------------------------------------------------------------

/**
 * Squared Euclidean distance between two RGB colors.
 * No square-root needed — we only compare distances.
 */
export function colorDistanceSq(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return dr * dr + dg * dg + db * db
}

/**
 * Return the palette index of the nearest color to (r, g, b).
 * Skips index 4 (null slot).
 */
export function nearestPaletteIndex(r: number, g: number, b: number): number {
  let bestIdx = 0
  let bestDist = Infinity
  for (const [idx, pr, pg, pb] of VALID_COLORS) {
    const d = colorDistanceSq(r, g, b, pr, pg, pb)
    if (d < bestDist) {
      bestDist = d
      bestIdx = idx
    }
  }
  return bestIdx
}

// ---------------------------------------------------------------------------
// Nearest-neighbor quantization
// ---------------------------------------------------------------------------

/**
 * Quantize an RGBA image to palette indices using nearest-neighbor matching.
 *
 * @param rgba   RGBA pixel data (length = width × height × 4)
 * @param width  Image width in pixels
 * @param height Image height in pixels
 * @returns Uint8Array of palette indices (length = width × height)
 */
export function quantizeNearest(
  rgba: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const total = width * height
  const indices = new Uint8Array(total)

  for (let i = 0; i < total; i++) {
    const off = i * 4
    indices[i] = nearestPaletteIndex(rgba[off], rgba[off + 1], rgba[off + 2])
  }
  return indices
}

// ---------------------------------------------------------------------------
// Floyd-Steinberg dithering
// ---------------------------------------------------------------------------

/** Clamp a value to [0, 255]. */
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/**
 * Quantize an RGBA image using Floyd-Steinberg error-diffusion dithering.
 *
 * Error buffer is stored as a flat Float32Array (width × height × 3) for
 * cache-friendly access. The initial values are copied from the input RGBA
 * data (alpha channel ignored).
 *
 * @param rgba   RGBA pixel data (length = width × height × 4)
 * @param width  Image width in pixels
 * @param height Image height in pixels
 * @returns Uint8Array of palette indices (length = width × height)
 */
export function quantizeFloydSteinberg(
  rgba: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const total = width * height
  const indices = new Uint8Array(total)

  // Float buffer: stores running RGB values (initial = input, then += error)
  const buf = new Float32Array(total * 3)
  for (let i = 0; i < total; i++) {
    const off4 = i * 4
    const off3 = i * 3
    buf[off3] = rgba[off4]
    buf[off3 + 1] = rgba[off4 + 1]
    buf[off3 + 2] = rgba[off4 + 2]
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const off = idx * 3

      // Clamp & round current pixel
      const cr = Math.round(clamp255(buf[off]))
      const cg = Math.round(clamp255(buf[off + 1]))
      const cb = Math.round(clamp255(buf[off + 2]))

      // Find nearest palette color
      const palIdx = nearestPaletteIndex(cr, cg, cb)
      indices[idx] = palIdx

      const palColor = EPD_PALETTE[palIdx] as RGB

      // Quantization error
      const errR = buf[off] - palColor[0]
      const errG = buf[off + 1] - palColor[1]
      const errB = buf[off + 2] - palColor[2]

      // Distribute error to neighbors (Floyd-Steinberg weights)
      // Right (x+1, y): 7/16
      if (x + 1 < width) {
        const nOff = off + 3
        buf[nOff] += errR * (7 / 16)
        buf[nOff + 1] += errG * (7 / 16)
        buf[nOff + 2] += errB * (7 / 16)
      }
      // Bottom-left (x-1, y+1): 3/16
      if (y + 1 < height && x - 1 >= 0) {
        const nOff = (idx + width - 1) * 3
        buf[nOff] += errR * (3 / 16)
        buf[nOff + 1] += errG * (3 / 16)
        buf[nOff + 2] += errB * (3 / 16)
      }
      // Bottom (x, y+1): 5/16
      if (y + 1 < height) {
        const nOff = (idx + width) * 3
        buf[nOff] += errR * (5 / 16)
        buf[nOff + 1] += errG * (5 / 16)
        buf[nOff + 2] += errB * (5 / 16)
      }
      // Bottom-right (x+1, y+1): 1/16
      if (y + 1 < height && x + 1 < width) {
        const nOff = (idx + width + 1) * 3
        buf[nOff] += errR * (1 / 16)
        buf[nOff + 1] += errG * (1 / 16)
        buf[nOff + 2] += errB * (1 / 16)
      }
    }
  }

  return indices
}

// ---------------------------------------------------------------------------
// Saturation enhancement (RGB ↔ HSL)
// ---------------------------------------------------------------------------

/**
 * Convert RGB [0-255] to HSL [h: 0-360, s: 0-1, l: 0-1].
 */
function rgbToHsl(r: number, g: number, b: number): [h: number, s: number, l: number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) {
    return [0, 0, l]  // achromatic
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) * 60
  } else {
    h = ((rn - gn) / d + 4) * 60
  }

  return [h, s, l]
}

/**
 * Convert HSL [h: 0-360, s: 0-1, l: 0-1] to RGB [0-255].
 */
function hslToRgb(h: number, s: number, l: number): [r: number, g: number, b: number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hNorm = h / 360

  return [
    Math.round(hueToRgb(p, q, hNorm + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hNorm) * 255),
    Math.round(hueToRgb(p, q, hNorm - 1 / 3) * 255),
  ]
}

/**
 * Enhance the saturation of an RGBA image.
 *
 * Each pixel is converted RGB→HSL, the S component is multiplied by `factor`
 * (clamped to [0, 1]), then converted back to RGB.
 *
 * @param rgba   RGBA pixel data (length = width × height × 4)
 * @param width  Image width
 * @param height Image height
 * @param factor Saturation multiplier (default 1.4; 1.0 = no change)
 * @returns New RGBA Uint8Array with enhanced saturation
 */
export function enhanceSaturation(
  rgba: Uint8Array,
  width: number,
  height: number,
  factor: number = 1.4,
): Uint8Array {
  const total = width * height
  const out = new Uint8Array(rgba.length)

  for (let i = 0; i < total; i++) {
    const off = i * 4
    const r = rgba[off]
    const g = rgba[off + 1]
    const b = rgba[off + 2]
    const a = rgba[off + 3]

    const [h, s, l] = rgbToHsl(r, g, b)
    const newS = Math.min(1, Math.max(0, s * factor))
    const [nr, ng, nb] = hslToRgb(h, newS, l)

    out[off] = nr
    out[off + 1] = ng
    out[off + 2] = nb
    out[off + 3] = a  // preserve alpha
  }

  return out
}
