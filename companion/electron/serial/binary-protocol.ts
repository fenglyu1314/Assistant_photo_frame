/**
 * Binary Frame Protocol - PC Side Encoder
 *
 * Pure logic module: protocol constants, CRC-16/CCITT, frame building.
 * Fully aligned with firmware/include/protocol.h
 *
 * Frame format: MAGIC(2B) + CMD(1B) + LENGTH(4B LE) + DATA(NB) + CRC(2B LE)
 * CRC covers: CMD + LENGTH + DATA
 */

// ============================================================================
// Protocol Constants (aligned with firmware/include/protocol.h)
// ============================================================================

/** Frame magic bytes */
export const MAGIC = Buffer.from([0xeb, 0x0d])

/** Command types (PC → ESP32) */
export const CMD_BEGIN = 0x01
export const CMD_DATA = 0x02
export const CMD_END = 0x03
export const CMD_PING = 0xff

/** Response types (ESP32 → PC) */
export const RESP_PONG = 0x80
export const RESP_ACK = 0x81
export const RESP_NAK = 0x82
export const RESP_DISPLAY_DONE = 0x83

/** Frame buffer constants */
export const FRAME_BUFFER_SIZE = 192000 // 800/2 * 480, 4-bit packed
export const DEFAULT_CHUNK_SIZE = 4096

/** Timeout values (milliseconds) */
export const CHUNK_ACK_TIMEOUT_MS = 5000 // Per-chunk ACK wait
export const TRANSFER_TIMEOUT_MS = 60000 // Entire transfer must complete
export const DISPLAY_DONE_TIMEOUT_MS = 30000 // EPD refresh ~15-20s
export const PING_TIMEOUT_MS = 3000 // PING/PONG timeout

/** Retry limits */
export const MAX_CHUNK_RETRIES = 3

// ============================================================================
// CRC-16/CCITT (poly=0x1021, init=0x0000)
// Matches firmware/lib/SerialProtocol/crc16.cpp exactly
// ============================================================================

/**
 * Update CRC with a single byte
 */
export function crc16Update(crc: number, byte: number): number {
  crc ^= (byte & 0xff) << 8
  for (let i = 0; i < 8; i++) {
    if (crc & 0x8000) {
      crc = ((crc << 1) ^ 0x1021) & 0xffff
    } else {
      crc = (crc << 1) & 0xffff
    }
  }
  return crc
}

/**
 * Calculate CRC-16/CCITT over a buffer
 */
export function crc16Ccitt(data: Buffer): number {
  let crc = 0x0000
  for (let i = 0; i < data.length; i++) {
    crc = crc16Update(crc, data[i])
  }
  return crc
}

// ============================================================================
// Frame Building
// ============================================================================

/**
 * Build a complete protocol frame: MAGIC + CMD + LENGTH(LE) + DATA + CRC(LE)
 * CRC covers CMD + LENGTH + DATA bytes.
 */
export function buildFrame(cmd: number, payload?: Buffer): Buffer {
  const data = payload ?? Buffer.alloc(0)

  // CMD (1 byte) + LENGTH (4 bytes LE) + DATA
  const length = Buffer.alloc(4)
  length.writeUInt32LE(data.length)

  const headerAndData = Buffer.concat([Buffer.from([cmd]), length, data])

  // CRC over CMD + LENGTH + DATA
  const crc = crc16Ccitt(headerAndData)
  const crcBytes = Buffer.alloc(2)
  crcBytes.writeUInt16LE(crc)

  return Buffer.concat([MAGIC, headerAndData, crcBytes])
}

// ============================================================================
// Convenience Frame Builders
// ============================================================================

/**
 * Build a BEGIN frame to start a frame buffer transfer.
 * Payload: total_size(4B LE) + chunk_size(2B LE) + total_chunks(2B LE)
 */
export function buildBeginFrame(
  totalSize: number,
  chunkSize: number,
  totalChunks: number
): Buffer {
  const payload = Buffer.alloc(8)
  payload.writeUInt32LE(totalSize, 0)
  payload.writeUInt16LE(chunkSize, 4)
  payload.writeUInt16LE(totalChunks, 6)
  return buildFrame(CMD_BEGIN, payload)
}

/**
 * Build a DATA frame for a single chunk.
 * Payload: chunk_index(2B LE) + chunk_data(NB)
 */
export function buildDataFrame(chunkIndex: number, chunkData: Buffer): Buffer {
  const indexBuf = Buffer.alloc(2)
  indexBuf.writeUInt16LE(chunkIndex)
  const payload = Buffer.concat([indexBuf, chunkData])
  return buildFrame(CMD_DATA, payload)
}

/**
 * Build an END frame to signal transfer completion.
 * No payload.
 */
export function buildEndFrame(): Buffer {
  return buildFrame(CMD_END)
}

/**
 * Build a PING frame for heartbeat check.
 * No payload.
 */
export function buildPingFrame(): Buffer {
  return buildFrame(CMD_PING)
}
