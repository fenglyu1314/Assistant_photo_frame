#pragma once

#include <Arduino.h>

// ============================================================================
// Binary Frame Protocol Constants
// ============================================================================

// Frame magic number (2 bytes)
#define PROTO_MAGIC_0   0xEB
#define PROTO_MAGIC_1   0x0D

// Frame header size: MAGIC(2) + CMD(1) + LENGTH(4) = 7 bytes
#define PROTO_HEADER_SIZE  7

// CRC size: 2 bytes
#define PROTO_CRC_SIZE     2

// Maximum DATA payload per frame (DataPayloadHeader + chunk_data)
#define PROTO_MAX_DATA_LEN (4096 + 4)

// ============================================================================
// Command Types
// ============================================================================

enum ProtoCmd : uint8_t {
    CMD_BEGIN = 0x01,   // Frame buffer transfer start
    CMD_DATA  = 0x02,   // Data chunk
    CMD_END   = 0x03,   // Transfer complete
    CMD_PING  = 0xFF,   // Heartbeat
};

// Response command types (ESP32 → PC)
enum ProtoResp : uint8_t {
    RESP_PONG        = 0x80,  // PING response
    RESP_ACK         = 0x81,  // Chunk received OK
    RESP_NAK         = 0x82,  // Chunk rejected (CRC error, etc.)
    RESP_DISPLAY_DONE = 0x83, // EPD refresh complete
};

// ============================================================================
// BEGIN frame payload layout (10 bytes)
// ============================================================================

struct BeginPayload {
    uint32_t total_size;     // Total frame buffer size (192000)
    uint16_t chunk_size;     // Chunk size (4096)
    uint16_t total_chunks;   // Number of chunks (47)
} __attribute__((packed));

// ============================================================================
// DATA frame payload layout
// ============================================================================

struct DataPayloadHeader {
    uint16_t chunk_index;    // Chunk sequence number (0-based)
    // Followed by chunk_data (chunk_size bytes, last chunk may be smaller)
} __attribute__((packed));

// ============================================================================
// Frame buffer constants
// ============================================================================

#define FRAME_BUFFER_SIZE   192000   // 800/2 * 480, 4-bit packed
#define DEFAULT_CHUNK_SIZE  4096
#define MAX_CHUNKS          64       // Bitmap size: 64 bits = 8 bytes
#define RX_BUFFER_SIZE      8192     // Serial RX buffer

// ============================================================================
// Timeout values (milliseconds)
// ============================================================================

#define FRAME_BYTE_TIMEOUT_MS    5000   // No byte received within frame
#define TRANSFER_TIMEOUT_MS      60000  // Entire transfer must complete
