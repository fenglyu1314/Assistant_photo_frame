/**
 * Response Parser - Stream-based state machine
 *
 * Parses firmware responses (PONG/ACK/NAK/DISPLAY_DONE) from serial byte stream.
 * Handles partial buffer delivery and ignores debug log text from ESP32.
 *
 * Response format (all start with MAGIC 0xEB 0x0D):
 *   PONG:         EB 0D 80           (3 bytes)
 *   ACK:          EB 0D 81 lo hi     (5 bytes, chunk_index LE)
 *   NAK:          EB 0D 82 lo hi     (5 bytes, chunk_index LE)
 *   DISPLAY_DONE: EB 0D 83           (3 bytes)
 */

import { EventEmitter } from 'events'
import { RESP_PONG, RESP_ACK, RESP_NAK, RESP_DISPLAY_DONE } from './binary-protocol'

// ============================================================================
// Types
// ============================================================================

export type ResponseType = 'pong' | 'ack' | 'nak' | 'display-done'

export interface ParsedResponse {
  type: ResponseType
  /** Chunk index for ACK/NAK responses */
  chunkIndex?: number
}

// ============================================================================
// Parser States
// ============================================================================

const enum State {
  /** Waiting for first magic byte 0xEB */
  WAIT_MAGIC_0,
  /** Got 0xEB, waiting for second magic byte 0x0D */
  WAIT_MAGIC_1,
  /** Got magic, waiting for response type byte */
  WAIT_TYPE,
  /** Got ACK/NAK type, waiting for chunk_index low byte */
  WAIT_INDEX_LO,
  /** Got index low byte, waiting for chunk_index high byte */
  WAIT_INDEX_HI
}

// ============================================================================
// ResponseParser
// ============================================================================

export class ResponseParser extends EventEmitter {
  private state: State = State.WAIT_MAGIC_0
  private currentType: number = 0
  private indexLo: number = 0

  constructor() {
    super()
  }

  /**
   * Feed raw bytes from the serial port data event.
   * Emits 'response' event for each complete response found.
   */
  feed(data: Buffer): void {
    for (let i = 0; i < data.length; i++) {
      this.processByte(data[i])
    }
  }

  /**
   * Reset parser state (e.g., on reconnect)
   */
  reset(): void {
    this.state = State.WAIT_MAGIC_0
    this.currentType = 0
    this.indexLo = 0
  }

  private processByte(byte: number): void {
    switch (this.state) {
      case State.WAIT_MAGIC_0:
        if (byte === 0xeb) {
          this.state = State.WAIT_MAGIC_1
        }
        // Non-magic bytes (debug log text) are silently skipped
        break

      case State.WAIT_MAGIC_1:
        if (byte === 0x0d) {
          this.state = State.WAIT_TYPE
        } else if (byte === 0xeb) {
          // Stay in WAIT_MAGIC_1 — could be consecutive 0xEB bytes
          this.state = State.WAIT_MAGIC_1
        } else {
          // False alarm, reset
          this.state = State.WAIT_MAGIC_0
        }
        break

      case State.WAIT_TYPE:
        this.currentType = byte
        if (byte === RESP_ACK || byte === RESP_NAK) {
          // These have 2-byte chunk_index payload
          this.state = State.WAIT_INDEX_LO
        } else if (byte === RESP_PONG || byte === RESP_DISPLAY_DONE) {
          // No payload, emit immediately
          this.emitResponse(byte)
          this.state = State.WAIT_MAGIC_0
        } else {
          // Unknown response type, reset
          this.state = State.WAIT_MAGIC_0
        }
        break

      case State.WAIT_INDEX_LO:
        this.indexLo = byte
        this.state = State.WAIT_INDEX_HI
        break

      case State.WAIT_INDEX_HI: {
        const chunkIndex = this.indexLo | (byte << 8) // little-endian
        this.emitResponse(this.currentType, chunkIndex)
        this.state = State.WAIT_MAGIC_0
        break
      }
    }
  }

  private emitResponse(respType: number, chunkIndex?: number): void {
    const typeMap: Record<number, ResponseType> = {
      [RESP_PONG]: 'pong',
      [RESP_ACK]: 'ack',
      [RESP_NAK]: 'nak',
      [RESP_DISPLAY_DONE]: 'display-done'
    }

    const type = typeMap[respType]
    if (!type) return

    const response: ParsedResponse = { type }
    if (chunkIndex !== undefined) {
      response.chunkIndex = chunkIndex
    }

    this.emit('response', response)
  }
}
