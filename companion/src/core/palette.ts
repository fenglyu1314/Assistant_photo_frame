/**
 * EPD 7-color e-Paper palette definitions.
 *
 * Color indices align with the Waveshare hardware ColorSelection enum.
 * Index 4 (Orange) is skipped — the 7.3" panel only supports 6 usable colors.
 */

/** RGB tuple */
export type RGB = [r: number, g: number, b: number]

/**
 * Valid color index values that can appear in quantized output.
 * Index 4 is never produced.
 */
export type ColorIndex = 0 | 1 | 2 | 3 | 5 | 6

/**
 * Hardware-aligned palette.
 *   0 = BLACK, 1 = WHITE, 2 = YELLOW, 3 = RED,
 *   4 = (skipped/null), 5 = BLUE, 6 = GREEN
 */
export const EPD_PALETTE: ReadonlyArray<RGB | null> = [
  [0, 0, 0],       // 0  BLACK
  [255, 255, 255], // 1  WHITE
  [255, 255, 0],   // 2  YELLOW
  [255, 0, 0],     // 3  RED
  null,            // 4  (Orange – not supported, skip)
  [0, 0, 255],     // 5  BLUE
  [0, 255, 0],     // 6  GREEN
]

/** Human-readable names for each palette slot. */
export const PALETTE_NAMES: ReadonlyArray<string> = [
  'BLACK',
  'WHITE',
  'YELLOW',
  'RED',
  'ORANGE (skip)',
  'BLUE',
  'GREEN',
]

// ---------------------------------------------------------------------------
// EPD physical constants
// ---------------------------------------------------------------------------

/** Logical width  (portrait orientation, rotation = 3) */
export const EPD_LOGICAL_W = 480

/** Logical height (portrait orientation, rotation = 3) */
export const EPD_LOGICAL_H = 800

/** Raw panel width  (landscape, how hardware addresses pixels) */
export const EPD_RAW_W = 800

/** Raw panel height (landscape, how hardware addresses pixels) */
export const EPD_RAW_H = 480

/**
 * Frame-buffer size in bytes.
 * Each byte holds two 4-bit color indices → 800 / 2 × 480 = 192 000.
 */
export const FRAME_BUFFER_SIZE = 192_000
