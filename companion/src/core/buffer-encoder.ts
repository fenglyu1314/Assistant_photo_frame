/**
 * Physical frame-buffer encoder for the EPD 7.3" 7-color e-Paper.
 *
 * Transforms a logical 480×800 color-index array (portrait) into the
 * 192 000-byte physical buffer that the hardware SPI controller expects:
 *
 *   1. rotation = 3 (270°) coordinate transform:
 *        logical (lx, ly) → physical (px, py) = (ly, 479 − lx)
 *
 *   2. 4-bit packing:
 *        Even px → high nibble, odd px → low nibble
 *        byte address = floor(px / 2) + py × 400
 */

import {
  EPD_LOGICAL_W,
  EPD_LOGICAL_H,
  EPD_RAW_W,
  FRAME_BUFFER_SIZE,
} from './palette'

/** Half the raw width — the number of bytes per row in the physical buffer. */
const BYTES_PER_ROW = EPD_RAW_W / 2  // 400

/**
 * Encode a logical-coordinate index array into the physical frame buffer.
 *
 * @param indices    Color-index array (length = logicalW × logicalH).
 *                   Each element is a palette index 0-6 (never 4).
 * @param logicalW   Logical width  (default 480)
 * @param logicalH   Logical height (default 800)
 * @returns Uint8Array of length 192 000 (4-bit packed physical buffer)
 */
export function encodeToPhysicalBuffer(
  indices: Uint8Array,
  logicalW: number = EPD_LOGICAL_W,
  logicalH: number = EPD_LOGICAL_H,
): Uint8Array {
  const buf = new Uint8Array(FRAME_BUFFER_SIZE)

  for (let ly = 0; ly < logicalH; ly++) {
    for (let lx = 0; lx < logicalW; lx++) {
      const colorIdx = indices[ly * logicalW + lx]

      // rotation = 3 transform
      const px = ly
      const py = (logicalW - 1) - lx  // 479 - lx

      // 4-bit packing
      const addr = (px >> 1) + py * BYTES_PER_ROW

      if ((px & 1) === 0) {
        // Even px → high nibble
        buf[addr] = (buf[addr] & 0x0F) | ((colorIdx & 0x0F) << 4)
      } else {
        // Odd px → low nibble
        buf[addr] = (buf[addr] & 0xF0) | (colorIdx & 0x0F)
      }
    }
  }

  return buf
}
