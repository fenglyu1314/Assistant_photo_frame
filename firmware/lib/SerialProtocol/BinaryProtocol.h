#pragma once

#include <Arduino.h>
#include "protocol.h"
#include "crc16.h"
#include "EPaperDriver.h"

// ============================================================================
// Protocol State Machine States
// ============================================================================

enum class ProtoState : uint8_t {
    IDLE,            // Waiting for MAGIC byte 0xEB
    MAGIC_PARTIAL,   // Got 0xEB, waiting for 0x0D
    WAIT_CMD,        // Got MAGIC, waiting for CMD byte
    WAIT_LEN,        // Got CMD, receiving 4-byte LENGTH (LE)
    WAIT_DATA,       // Got LENGTH, receiving DATA bytes
    WAIT_CRC,        // Got DATA, receiving 2-byte CRC (LE)
};

// ============================================================================
// Transfer State
// ============================================================================

struct TransferState {
    bool        active;           // True if a transfer is in progress
    uint32_t    total_size;       // From BEGIN frame
    uint16_t    chunk_size;       // From BEGIN frame
    uint16_t    total_chunks;     // From BEGIN frame
    uint64_t    received_bitmap;  // Bit N set = chunk N received
    uint16_t    received_count;   // Number of chunks received so far
    unsigned long begin_time;     // millis() when BEGIN was received
};

// ============================================================================
// BinaryProtocol Class
// ============================================================================

class BinaryProtocol {
public:
    /**
     * @param epd Pointer to ePaperPort driver (for display())
     * @param framebuf PSRAM frame buffer (FRAME_BUFFER_SIZE bytes)
     */
    BinaryProtocol(ePaperPort *epd, uint8_t *framebuf);

    /**
     * Process available serial data. Call in loop().
     */
    void process();

    /**
     * Reset state machine to IDLE, clear transfer state.
     */
    void reset();

    /**
     * Get current protocol state (for debugging).
     */
    ProtoState getState() const { return state_; }

    /**
     * Get transfer state (for debugging).
     */
    const TransferState& getTransfer() const { return transfer_; }

    // Response send helpers
    static void sendPong();
    static void sendAck(uint16_t chunk_index);
    static void sendNak(uint16_t chunk_index);
    static void sendDisplayDone();

private:
    // State machine
    ProtoState state_;
    uint8_t    cmd_;
    uint32_t   length_;
    uint16_t   crc_received_;

    // Reception buffers
    uint8_t    len_buf_[4];         // LENGTH bytes accumulator
    uint8_t    data_buf_[PROTO_MAX_DATA_LEN]; // DATA accumulator (max payload)
    uint16_t   data_pos_;           // Current position in data_buf_
    uint8_t    crc_pos_;            // CRC bytes received (0 or 1)

    // CRC calculation (incremental)
    uint16_t   crc_calc_;

    // Timeout tracking
    unsigned long last_byte_time_;

    // Transfer state
    TransferState transfer_;

    // Hardware references
    ePaperPort *epd_;
    uint8_t    *framebuf_;

    // Internal methods
    void feedByte(uint8_t byte);
    void handleCompleteFrame();
    void handleBeginFrame();
    void handleDataFrame();
    void handleEndFrame();
    void handlePingFrame();
    void resetTransfer();
    bool isChunkReceived(uint16_t index) const;
    void markChunkReceived(uint16_t index);
    void checkTimeouts();
};
