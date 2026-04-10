/**
 * Quantized Preview Generator
 *
 * Converts palette indices (output of Floyd-Steinberg quantization) back to
 * an RGB image for visual preview. Also computes per-color usage statistics.
 *
 * This module is the "reverse visualization" counterpart to the quantizer:
 *   quantizer: RGBA → palette indices
 *   quantized-preview: palette indices → RGBA → PNG dataURL
 */

import { EPD_PALETTE, type ColorIndex } from './palette'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-color usage statistics */
export interface ColorStat {
  /** Palette index (0,1,2,3,5,6) */
  index: number
  /** Human-readable color name */
  name: string
  /** Number of pixels using this color */
  count: number
  /** Percentage of total pixels (0-100, 2 decimal places) */
  percent: number
}

/** Complete color statistics for a quantized image */
export type ColorStats = ColorStat[]

/** Result of quantized preview generation */
export interface QuantizedPreviewResult {
  /** PNG data URL (data:image/png;base64,...) */
  dataUrl: string
  /** Per-color usage statistics */
  colorStats: ColorStats
}

// ---------------------------------------------------------------------------
// Color name mapping
// ---------------------------------------------------------------------------

const COLOR_NAMES: Record<number, string> = {
  0: 'BLACK',
  1: 'WHITE',
  2: 'YELLOW',
  3: 'RED',
  5: 'BLUE',
  6: 'GREEN',
}

/** Valid palette indices (skipping index 4) */
const VALID_INDICES: readonly ColorIndex[] = [0, 1, 2, 3, 5, 6]

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Convert palette indices to RGBA pixel data.
 *
 * Each palette index is looked up in EPD_PALETTE to get the RGB value,
 * then written as RGBA (alpha = 255) into the output buffer.
 *
 * @param indices  Palette index array (length = width × height)
 * @param width    Image width in pixels
 * @param height   Image height in pixels
 * @returns RGBA Uint8Array (length = width × height × 4)
 */
export function indicesToRgba(
  indices: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const total = width * height
  if (indices.length !== total) {
    throw new Error(
      `indices length (${indices.length}) does not match width × height (${total})`
    )
  }

  const rgba = new Uint8Array(total * 4)

  for (let i = 0; i < total; i++) {
    const palIdx = indices[i]
    const color = EPD_PALETTE[palIdx]

    const off = i * 4
    if (color !== null && color !== undefined) {
      rgba[off] = color[0]     // R
      rgba[off + 1] = color[1] // G
      rgba[off + 2] = color[2] // B
    } else {
      // Fallback for invalid/skipped index: render as magenta for visibility
      rgba[off] = 255
      rgba[off + 1] = 0
      rgba[off + 2] = 255
    }
    rgba[off + 3] = 255 // A (fully opaque)
  }

  return rgba
}

/**
 * Compute per-color usage statistics from palette indices.
 *
 * @param indices  Palette index array (length = width × height)
 * @returns Array of ColorStat for each valid palette color
 */
export function computeColorStats(indices: Uint8Array): ColorStats {
  const total = indices.length

  // Count occurrences of each valid index
  const counts = new Map<number, number>()
  for (const idx of VALID_INDICES) {
    counts.set(idx, 0)
  }

  for (let i = 0; i < total; i++) {
    const palIdx = indices[i]
    const current = counts.get(palIdx)
    if (current !== undefined) {
      counts.set(palIdx, current + 1)
    }
  }

  // Build stats array
  const stats: ColorStats = VALID_INDICES.map((idx) => ({
    index: idx,
    name: COLOR_NAMES[idx] || `INDEX_${idx}`,
    count: counts.get(idx) || 0,
    percent: total > 0
      ? Math.round(((counts.get(idx) || 0) / total) * 10000) / 100
      : 0,
  }))

  return stats
}

/**
 * Convert palette indices to a PNG data URL and compute color statistics.
 *
 * Uses Electron's nativeImage.createFromBuffer() for zero-dependency
 * RGBA → PNG conversion.
 *
 * @param indices  Palette index array (length = width × height)
 * @param width    Image width in pixels
 * @param height   Image height in pixels
 * @returns QuantizedPreviewResult with PNG dataURL and color stats
 */
export function indicesToDataUrl(
  indices: Uint8Array,
  width: number,
  height: number,
): QuantizedPreviewResult {
  // Step 1: Convert indices to RGBA
  const rgba = indicesToRgba(indices, width, height)

  // Step 2: Compute color statistics
  const colorStats = computeColorStats(indices)

  // Step 3: Create NativeImage from RGBA buffer → PNG data URL
  // Dynamic require to avoid breaking pure-function unit tests in non-Electron env
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { nativeImage } = require('electron')
  const image = nativeImage.createFromBuffer(Buffer.from(rgba.buffer), {
    width,
    height,
  })

  const dataUrl = image.toDataURL()

  return { dataUrl, colorStats }
}
