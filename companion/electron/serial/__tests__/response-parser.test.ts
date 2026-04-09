/**
 * Tests for response-parser.ts
 *
 * Covers: PONG/ACK/NAK/DISPLAY_DONE parsing, cross-buffer splits,
 *         debug text filtering, consecutive responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResponseParser, type ParsedResponse } from '../response-parser'

function createParser(): { parser: ResponseParser; responses: ParsedResponse[] } {
  const parser = new ResponseParser()
  const responses: ParsedResponse[] = []
  parser.on('response', (r: ParsedResponse) => responses.push(r))
  return { parser, responses }
}

// ============================================================================
// Basic Response Parsing
// ============================================================================

describe('ResponseParser - basic parsing', () => {
  it('should parse PONG response (EB 0D 80)', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.from([0xeb, 0x0d, 0x80]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'pong' })
  })

  it('should parse ACK response with chunk index (EB 0D 81 lo hi)', () => {
    const { parser, responses } = createParser()
    // ACK for chunk index 5 (0x0005 LE = 05 00)
    parser.feed(Buffer.from([0xeb, 0x0d, 0x81, 0x05, 0x00]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'ack', chunkIndex: 5 })
  })

  it('should parse NAK response with chunk index', () => {
    const { parser, responses } = createParser()
    // NAK for chunk index 46 (0x002E LE = 2E 00)
    parser.feed(Buffer.from([0xeb, 0x0d, 0x82, 0x2e, 0x00]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'nak', chunkIndex: 46 })
  })

  it('should parse DISPLAY_DONE response (EB 0D 83)', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.from([0xeb, 0x0d, 0x83]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'display-done' })
  })

  it('should handle ACK with high chunk index (LE encoding)', () => {
    const { parser, responses } = createParser()
    // ACK for chunk 256 (0x0100 LE = 00 01)
    parser.feed(Buffer.from([0xeb, 0x0d, 0x81, 0x00, 0x01]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'ack', chunkIndex: 256 })
  })
})

// ============================================================================
// Cross-Buffer Splitting
// ============================================================================

describe('ResponseParser - cross-buffer splits', () => {
  it('should handle response split across two buffers', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.from([0xeb]))
    expect(responses).toHaveLength(0)
    parser.feed(Buffer.from([0x0d, 0x80]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'pong' })
  })

  it('should handle ACK split at every byte boundary', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.from([0xeb]))
    parser.feed(Buffer.from([0x0d]))
    parser.feed(Buffer.from([0x81]))
    parser.feed(Buffer.from([0x03]))
    parser.feed(Buffer.from([0x00]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'ack', chunkIndex: 3 })
  })

  it('should handle split between type and payload', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.from([0xeb, 0x0d, 0x82])) // NAK type
    expect(responses).toHaveLength(0)
    parser.feed(Buffer.from([0x0a, 0x00])) // chunk index 10
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'nak', chunkIndex: 10 })
  })
})

// ============================================================================
// Debug Text Filtering
// ============================================================================

describe('ResponseParser - debug text filtering', () => {
  it('should skip non-magic bytes (debug log text)', () => {
    const { parser, responses } = createParser()
    // Debug text followed by PONG
    const debugText = Buffer.from('[INF] Transfer BEGIN received\r\n', 'ascii')
    const pong = Buffer.from([0xeb, 0x0d, 0x80])
    parser.feed(Buffer.concat([debugText, pong]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'pong' })
  })

  it('should handle interleaved debug text and responses', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.from('debug\r\n', 'ascii'))
    parser.feed(Buffer.from([0xeb, 0x0d, 0x81, 0x00, 0x00])) // ACK(0)
    parser.feed(Buffer.from('[OK]\r\n', 'ascii'))
    parser.feed(Buffer.from([0xeb, 0x0d, 0x81, 0x01, 0x00])) // ACK(1)
    expect(responses).toHaveLength(2)
    expect(responses[0]).toEqual({ type: 'ack', chunkIndex: 0 })
    expect(responses[1]).toEqual({ type: 'ack', chunkIndex: 1 })
  })

  it('should handle 0xEB in debug text that is not followed by 0x0D', () => {
    const { parser, responses } = createParser()
    // 0xEB appears in text but not followed by 0x0D
    parser.feed(Buffer.from([0xeb, 0x41, 0x42])) // EB followed by 'AB'
    parser.feed(Buffer.from([0xeb, 0x0d, 0x80])) // Real PONG
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'pong' })
  })
})

// ============================================================================
// Consecutive Multiple Responses
// ============================================================================

describe('ResponseParser - consecutive responses', () => {
  it('should parse multiple responses in a single buffer', () => {
    const { parser, responses } = createParser()
    // PONG + ACK(0) + ACK(1) in one buffer
    parser.feed(Buffer.from([
      0xeb, 0x0d, 0x80,             // PONG
      0xeb, 0x0d, 0x81, 0x00, 0x00, // ACK(0)
      0xeb, 0x0d, 0x81, 0x01, 0x00  // ACK(1)
    ]))
    expect(responses).toHaveLength(3)
    expect(responses[0]).toEqual({ type: 'pong' })
    expect(responses[1]).toEqual({ type: 'ack', chunkIndex: 0 })
    expect(responses[2]).toEqual({ type: 'ack', chunkIndex: 1 })
  })

  it('should parse ACK followed by DISPLAY_DONE', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.from([
      0xeb, 0x0d, 0x81, 0x2e, 0x00, // ACK(46)
      0xeb, 0x0d, 0x83              // DISPLAY_DONE
    ]))
    expect(responses).toHaveLength(2)
    expect(responses[0]).toEqual({ type: 'ack', chunkIndex: 46 })
    expect(responses[1]).toEqual({ type: 'display-done' })
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('ResponseParser - edge cases', () => {
  it('should handle unknown response type gracefully', () => {
    const { parser, responses } = createParser()
    // Unknown type 0x90
    parser.feed(Buffer.from([0xeb, 0x0d, 0x90]))
    expect(responses).toHaveLength(0)
    // Should recover and parse next valid response
    parser.feed(Buffer.from([0xeb, 0x0d, 0x80]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'pong' })
  })

  it('should handle consecutive 0xEB bytes', () => {
    const { parser, responses } = createParser()
    // Multiple 0xEB before valid magic
    parser.feed(Buffer.from([0xeb, 0xeb, 0x0d, 0x80]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'pong' })
  })

  it('should reset state properly', () => {
    const { parser, responses } = createParser()
    // Start parsing but reset midway
    parser.feed(Buffer.from([0xeb, 0x0d]))
    parser.reset()
    // Now feed a complete response
    parser.feed(Buffer.from([0xeb, 0x0d, 0x80]))
    expect(responses).toHaveLength(1)
    expect(responses[0]).toEqual({ type: 'pong' })
  })

  it('should handle empty buffer', () => {
    const { parser, responses } = createParser()
    parser.feed(Buffer.alloc(0))
    expect(responses).toHaveLength(0)
  })
})
