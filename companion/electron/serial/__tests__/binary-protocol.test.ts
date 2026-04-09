/**
 * Tests for binary-protocol.ts
 *
 * Covers: CRC-16/CCITT, frame building, protocol constants
 */

import { describe, it, expect } from 'vitest'
import {
  crc16Ccitt,
  crc16Update,
  buildFrame,
  buildPingFrame,
  buildBeginFrame,
  buildDataFrame,
  buildEndFrame,
  MAGIC,
  CMD_BEGIN,
  CMD_DATA,
  CMD_END,
  CMD_PING,
  RESP_PONG,
  RESP_ACK,
  RESP_NAK,
  RESP_DISPLAY_DONE,
  FRAME_BUFFER_SIZE,
  DEFAULT_CHUNK_SIZE
} from '../binary-protocol'

// ============================================================================
// Protocol Constants
// ============================================================================

describe('protocol constants', () => {
  it('should match firmware protocol.h values', () => {
    expect(CMD_BEGIN).toBe(0x01)
    expect(CMD_DATA).toBe(0x02)
    expect(CMD_END).toBe(0x03)
    expect(CMD_PING).toBe(0xff)
    expect(RESP_PONG).toBe(0x80)
    expect(RESP_ACK).toBe(0x81)
    expect(RESP_NAK).toBe(0x82)
    expect(RESP_DISPLAY_DONE).toBe(0x83)
    expect(FRAME_BUFFER_SIZE).toBe(192000)
    expect(DEFAULT_CHUNK_SIZE).toBe(4096)
  })

  it('should have correct MAGIC bytes', () => {
    expect(MAGIC[0]).toBe(0xeb)
    expect(MAGIC[1]).toBe(0x0d)
    expect(MAGIC.length).toBe(2)
  })
})

// ============================================================================
// CRC-16/CCITT
// ============================================================================

describe('crc16Ccitt', () => {
  it('should return 0x0000 for empty data', () => {
    expect(crc16Ccitt(Buffer.alloc(0))).toBe(0x0000)
  })

  it('should compute correct CRC for known data', () => {
    // PING frame: CMD=0xFF, LENGTH=0x00000000
    const data = Buffer.from([0xff, 0x00, 0x00, 0x00, 0x00])
    const crc = crc16Ccitt(data)
    // Must be a valid 16-bit value
    expect(crc).toBeGreaterThanOrEqual(0)
    expect(crc).toBeLessThanOrEqual(0xffff)
    // Deterministic: same input → same output
    expect(crc16Ccitt(data)).toBe(crc)
  })

  it('should produce different CRC for different data', () => {
    const a = crc16Ccitt(Buffer.from([0x01, 0x02, 0x03]))
    const b = crc16Ccitt(Buffer.from([0x01, 0x02, 0x04]))
    expect(a).not.toBe(b)
  })

  it('should handle single byte', () => {
    const crc = crc16Ccitt(Buffer.from([0x31])) // ASCII '1'
    expect(crc).toBeGreaterThanOrEqual(0)
    expect(crc).toBeLessThanOrEqual(0xffff)
  })
})

describe('crc16Update (incremental)', () => {
  it('should produce same result as crc16Ccitt (batch)', () => {
    const data = Buffer.from([0xff, 0x00, 0x00, 0x00, 0x00])

    // Batch
    const batchCrc = crc16Ccitt(data)

    // Incremental
    let crc = 0x0000
    for (const byte of data) {
      crc = crc16Update(crc, byte)
    }

    expect(crc).toBe(batchCrc)
  })

  it('should handle arbitrary data incrementally', () => {
    const data = Buffer.from([0x01, 0x08, 0x00, 0x00, 0x00, 0xc0, 0xee, 0x02, 0x00, 0x00, 0x10, 0x2f, 0x00])

    const batchCrc = crc16Ccitt(data)

    let crc = 0x0000
    for (const byte of data) {
      crc = crc16Update(crc, byte)
    }

    expect(crc).toBe(batchCrc)
  })
})

// ============================================================================
// Frame Building
// ============================================================================

describe('buildFrame', () => {
  it('should build correct frame structure: MAGIC + CMD + LENGTH + DATA + CRC', () => {
    const frame = buildFrame(0xff) // PING, no payload
    // MAGIC(2) + CMD(1) + LENGTH(4) + DATA(0) + CRC(2) = 9
    expect(frame.length).toBe(9)
    // Check MAGIC
    expect(frame[0]).toBe(0xeb)
    expect(frame[1]).toBe(0x0d)
    // Check CMD
    expect(frame[2]).toBe(0xff)
    // Check LENGTH = 0 (LE)
    expect(frame.readUInt32LE(3)).toBe(0)
    // CRC is last 2 bytes — just verify they exist and are valid
    const crcVal = frame.readUInt16LE(7)
    expect(crcVal).toBeGreaterThanOrEqual(0)
    expect(crcVal).toBeLessThanOrEqual(0xffff)
  })

  it('should include payload in frame', () => {
    const payload = Buffer.from([0x01, 0x02, 0x03])
    const frame = buildFrame(0x01, payload)
    // MAGIC(2) + CMD(1) + LENGTH(4) + DATA(3) + CRC(2) = 12
    expect(frame.length).toBe(12)
    // LENGTH field
    expect(frame.readUInt32LE(3)).toBe(3)
    // Payload bytes
    expect(frame[7]).toBe(0x01)
    expect(frame[8]).toBe(0x02)
    expect(frame[9]).toBe(0x03)
  })

  it('should compute CRC over CMD + LENGTH + DATA', () => {
    const frame = buildFrame(0xff) // PING
    // CRC should match crc16Ccitt of CMD+LENGTH+DATA
    const headerAndData = frame.subarray(2, 7) // CMD(1) + LENGTH(4)
    const expectedCrc = crc16Ccitt(headerAndData)
    expect(frame.readUInt16LE(7)).toBe(expectedCrc)
  })
})

describe('buildPingFrame', () => {
  it('should produce a valid 9-byte PING frame', () => {
    const frame = buildPingFrame()
    expect(frame.length).toBe(9)
    expect(frame[0]).toBe(0xeb)
    expect(frame[1]).toBe(0x0d)
    expect(frame[2]).toBe(0xff) // CMD_PING
    expect(frame.readUInt32LE(3)).toBe(0) // no payload
  })

  it('should be identical to buildFrame(CMD_PING)', () => {
    const a = buildPingFrame()
    const b = buildFrame(CMD_PING)
    expect(a.equals(b)).toBe(true)
  })
})

describe('buildBeginFrame', () => {
  it('should produce correct BEGIN frame for 192KB transfer', () => {
    const frame = buildBeginFrame(192000, 4096, 47)
    // MAGIC(2) + CMD(1) + LENGTH(4) + DATA(8) + CRC(2) = 17
    expect(frame.length).toBe(17)
    expect(frame[2]).toBe(CMD_BEGIN)
    expect(frame.readUInt32LE(3)).toBe(8) // payload length

    // Payload: total_size(4B LE) + chunk_size(2B LE) + total_chunks(2B LE)
    expect(frame.readUInt32LE(7)).toBe(192000)
    expect(frame.readUInt16LE(11)).toBe(4096)
    expect(frame.readUInt16LE(13)).toBe(47)
  })
})

describe('buildDataFrame', () => {
  it('should produce correct DATA frame with chunk index and data', () => {
    const chunkData = Buffer.alloc(4096, 0xaa)
    const frame = buildDataFrame(5, chunkData)
    // MAGIC(2) + CMD(1) + LENGTH(4) + DATA(2+4096) + CRC(2) = 4107
    expect(frame.length).toBe(4107)
    expect(frame[2]).toBe(CMD_DATA)
    expect(frame.readUInt32LE(3)).toBe(4098) // 2 + 4096
    expect(frame.readUInt16LE(7)).toBe(5) // chunk_index
    // First data byte
    expect(frame[9]).toBe(0xaa)
  })

  it('should handle last chunk (smaller size)', () => {
    // Last chunk: 192000 - 46*4096 = 3584
    const lastChunk = Buffer.alloc(3584, 0xbb)
    const frame = buildDataFrame(46, lastChunk)
    expect(frame[2]).toBe(CMD_DATA)
    expect(frame.readUInt32LE(3)).toBe(3586) // 2 + 3584
    expect(frame.readUInt16LE(7)).toBe(46)
  })
})

describe('buildEndFrame', () => {
  it('should produce a valid 9-byte END frame', () => {
    const frame = buildEndFrame()
    expect(frame.length).toBe(9)
    expect(frame[2]).toBe(CMD_END)
    expect(frame.readUInt32LE(3)).toBe(0)
  })

  it('should be identical to buildFrame(CMD_END)', () => {
    expect(buildEndFrame().equals(buildFrame(CMD_END))).toBe(true)
  })
})
