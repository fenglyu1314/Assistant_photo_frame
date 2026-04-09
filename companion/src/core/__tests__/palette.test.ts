import { describe, it, expect } from 'vitest'
import {
  EPD_PALETTE,
  PALETTE_NAMES,
  EPD_LOGICAL_W,
  EPD_LOGICAL_H,
  EPD_RAW_W,
  EPD_RAW_H,
  FRAME_BUFFER_SIZE,
} from '../palette'

describe('EPD_PALETTE', () => {
  it('has exactly 7 entries (indices 0-6)', () => {
    expect(EPD_PALETTE).toHaveLength(7)
  })

  it('index 0 is BLACK (0,0,0)', () => {
    expect(EPD_PALETTE[0]).toEqual([0, 0, 0])
  })

  it('index 1 is WHITE (255,255,255)', () => {
    expect(EPD_PALETTE[1]).toEqual([255, 255, 255])
  })

  it('index 2 is YELLOW (255,255,0)', () => {
    expect(EPD_PALETTE[2]).toEqual([255, 255, 0])
  })

  it('index 3 is RED (255,0,0)', () => {
    expect(EPD_PALETTE[3]).toEqual([255, 0, 0])
  })

  it('index 4 is null (skipped Orange)', () => {
    expect(EPD_PALETTE[4]).toBeNull()
  })

  it('index 5 is BLUE (0,0,255)', () => {
    expect(EPD_PALETTE[5]).toEqual([0, 0, 255])
  })

  it('index 6 is GREEN (0,255,0)', () => {
    expect(EPD_PALETTE[6]).toEqual([0, 255, 0])
  })
})

describe('PALETTE_NAMES', () => {
  it('has 7 entries matching palette length', () => {
    expect(PALETTE_NAMES).toHaveLength(7)
  })

  it('contains expected color names', () => {
    expect(PALETTE_NAMES[0]).toBe('BLACK')
    expect(PALETTE_NAMES[1]).toBe('WHITE')
    expect(PALETTE_NAMES[5]).toBe('BLUE')
    expect(PALETTE_NAMES[6]).toBe('GREEN')
  })
})

describe('EPD constants', () => {
  it('logical dimensions are 480×800', () => {
    expect(EPD_LOGICAL_W).toBe(480)
    expect(EPD_LOGICAL_H).toBe(800)
  })

  it('raw dimensions are 800×480', () => {
    expect(EPD_RAW_W).toBe(800)
    expect(EPD_RAW_H).toBe(480)
  })

  it('frame buffer size is 192000', () => {
    expect(FRAME_BUFFER_SIZE).toBe(192_000)
  })

  it('frame buffer = RAW_W/2 × RAW_H', () => {
    expect(FRAME_BUFFER_SIZE).toBe((EPD_RAW_W / 2) * EPD_RAW_H)
  })
})
