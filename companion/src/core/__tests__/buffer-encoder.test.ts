import { describe, it, expect } from 'vitest'
import { encodeToPhysicalBuffer } from '../buffer-encoder'
import {
  EPD_LOGICAL_W,
  EPD_LOGICAL_H,
  EPD_RAW_W,
  FRAME_BUFFER_SIZE,
} from '../palette'

const W = EPD_LOGICAL_W   // 480
const H = EPD_LOGICAL_H   // 800
const BYTES_PER_ROW = EPD_RAW_W / 2  // 400

// ---------------------------------------------------------------------------
// Helper: create a solid index array
// ---------------------------------------------------------------------------

function solidIndices(colorIdx: number): Uint8Array {
  return new Uint8Array(W * H).fill(colorIdx)
}

// ===========================================================================
// Tests
// ===========================================================================

describe('encodeToPhysicalBuffer', () => {
  it('returns buffer of exactly 192,000 bytes', () => {
    const buf = encodeToPhysicalBuffer(solidIndices(0), W, H)
    expect(buf).toHaveLength(FRAME_BUFFER_SIZE)
    expect(buf).toHaveLength(192_000)
  })

  it('all-BLACK (index 0) produces all 0x00', () => {
    const buf = encodeToPhysicalBuffer(solidIndices(0), W, H)
    for (const byte of buf) {
      expect(byte).toBe(0x00)
    }
  })

  it('all-WHITE (index 1) produces all 0x11', () => {
    const buf = encodeToPhysicalBuffer(solidIndices(1), W, H)
    for (const byte of buf) {
      expect(byte).toBe(0x11)
    }
  })

  it('all-RED (index 3) produces all 0x33', () => {
    const buf = encodeToPhysicalBuffer(solidIndices(3), W, H)
    for (const byte of buf) {
      expect(byte).toBe(0x33)
    }
  })

  it('all-BLUE (index 5) produces all 0x55', () => {
    const buf = encodeToPhysicalBuffer(solidIndices(5), W, H)
    for (const byte of buf) {
      expect(byte).toBe(0x55)
    }
  })

  it('all-GREEN (index 6) produces all 0x66', () => {
    const buf = encodeToPhysicalBuffer(solidIndices(6), W, H)
    for (const byte of buf) {
      expect(byte).toBe(0x66)
    }
  })

  // -----------------------------------------------------------------------
  // Single-pixel coordinate transform verification
  // -----------------------------------------------------------------------

  it('logical (0,0) maps to physical (0, 479)', () => {
    // Spec: (lx=0, ly=0) → (px=0, py=479)
    // addr = 0/2 + 479*400 = 191600, high nibble
    const indices = solidIndices(0)  // all BLACK
    indices[0] = 3  // set logical (0,0) = RED
    const buf = encodeToPhysicalBuffer(indices, W, H)

    const addr = 0 + 479 * BYTES_PER_ROW  // 191600
    expect((buf[addr] >> 4) & 0x0F).toBe(3)
  })

  it('logical (0,1) maps to physical (1, 479) → low nibble of same byte', () => {
    // (lx=0, ly=1) → (px=1, py=479)
    // addr = 1/2 = 0, + 479*400 = 191600, low nibble
    const indices = solidIndices(0)
    indices[1 * W + 0] = 5  // ly=1, lx=0 → BLUE
    const buf = encodeToPhysicalBuffer(indices, W, H)

    const addr = 0 + 479 * BYTES_PER_ROW  // 191600
    expect(buf[addr] & 0x0F).toBe(5)
  })

  it('packs two adjacent logical-y pixels into one byte correctly', () => {
    // Spec example: logical (0,0)=3, logical (0,1)=5
    // → physical (0,479) and (1,479)
    // → addr 191600: high=3, low=5 → 0x35
    const indices = solidIndices(0)
    indices[0 * W + 0] = 3  // (lx=0, ly=0) = RED
    indices[1 * W + 0] = 5  // (lx=0, ly=1) = BLUE
    const buf = encodeToPhysicalBuffer(indices, W, H)

    const addr = 0 + 479 * BYTES_PER_ROW
    expect(buf[addr]).toBe(0x35)
  })

  it('logical (479, 0) maps to physical (0, 0)', () => {
    // (lx=479, ly=0) → (px=0, py=479-479=0)
    // addr = 0/2 + 0*400 = 0, high nibble
    const indices = solidIndices(0)
    indices[0 * W + 479] = 6  // GREEN at logical (479, 0)
    const buf = encodeToPhysicalBuffer(indices, W, H)

    expect((buf[0] >> 4) & 0x0F).toBe(6)
  })

  it('logical (479, 799) maps to physical (799, 0)', () => {
    // (lx=479, ly=799) → (px=799, py=0)
    // addr = 799/2 = 399, + 0*400 = 399, low nibble (799 is odd)
    const indices = solidIndices(0)
    indices[799 * W + 479] = 2  // YELLOW at logical (479, 799)
    const buf = encodeToPhysicalBuffer(indices, W, H)

    expect(buf[399] & 0x0F).toBe(2)
  })

  // -----------------------------------------------------------------------
  // Mixed pattern
  // -----------------------------------------------------------------------

  it('alternating BLACK/WHITE columns produce checkerboard bytes', () => {
    // Create a pattern: even lx = BLACK(0), odd lx = WHITE(1)
    const indices = new Uint8Array(W * H)
    for (let ly = 0; ly < H; ly++) {
      for (let lx = 0; lx < W; lx++) {
        indices[ly * W + lx] = lx % 2 === 0 ? 0 : 1
      }
    }
    const buf = encodeToPhysicalBuffer(indices, W, H)

    // Verify buffer isn't all one value (has structure)
    const unique = new Set(buf)
    expect(unique.size).toBeGreaterThan(1)
  })
})
