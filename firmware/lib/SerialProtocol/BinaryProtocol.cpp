#include "BinaryProtocol.h"

// ============================================================================
// Constructor
// ============================================================================

BinaryProtocol::BinaryProtocol(ePaperPort *epd, uint8_t *framebuf)
    : state_(ProtoState::IDLE)
    , cmd_(0)
    , length_(0)
    , crc_received_(0)
    , data_pos_(0)
    , crc_pos_(0)
    , crc_calc_(0)
    , last_byte_time_(0)
    , epd_(epd)
    , framebuf_(framebuf)
{
    resetTransfer();
}

// ============================================================================
// Public: process() - called in loop()
// ============================================================================

void BinaryProtocol::process() {
    checkTimeouts();

    while (Serial.available()) {
        uint8_t byte = Serial.read();
        last_byte_time_ = millis();
        feedByte(byte);
    }
}

// ============================================================================
// Public: reset()
// ============================================================================

void BinaryProtocol::reset() {
    state_ = ProtoState::IDLE;
    cmd_ = 0;
    length_ = 0;
    crc_received_ = 0;
    data_pos_ = 0;
    crc_pos_ = 0;
    crc_calc_ = 0;
}

// ============================================================================
// State machine: feedByte()
// ============================================================================

void BinaryProtocol::feedByte(uint8_t byte) {
    switch (state_) {

    case ProtoState::IDLE:
        if (byte == PROTO_MAGIC_0) {
            state_ = ProtoState::MAGIC_PARTIAL;
        }
        // Non-MAGIC bytes ignored (debug text, etc.)
        break;

    case ProtoState::MAGIC_PARTIAL:
        if (byte == PROTO_MAGIC_1) {
            state_ = ProtoState::WAIT_CMD;
            // Start CRC calculation over CMD+LENGTH+DATA
            crc_calc_ = 0x0000;
        } else if (byte == PROTO_MAGIC_0) {
            // Stay in MAGIC_PARTIAL (consecutive 0xEB)
        } else {
            state_ = ProtoState::IDLE;
        }
        break;

    case ProtoState::WAIT_CMD:
        cmd_ = byte;
        // Validate CMD
        if (cmd_ == CMD_BEGIN || cmd_ == CMD_DATA || cmd_ == CMD_END || cmd_ == CMD_PING) {
            crc_calc_ = crc16_ccitt_update(crc_calc_, byte);
            length_ = 0;
            data_pos_ = 0;
            state_ = ProtoState::WAIT_LEN;
        } else {
            Serial.printf("[ERR] Unknown CMD: 0x%02X\n", cmd_);
            reset();
        }
        break;

    case ProtoState::WAIT_LEN: {
        // Accumulate LENGTH bytes (4 bytes, little-endian)
        len_buf_[data_pos_++] = byte;
        crc_calc_ = crc16_ccitt_update(crc_calc_, byte);

        if (data_pos_ >= 4) {
            // Assemble uint32 LE
            length_ = (uint32_t)len_buf_[0]
                    | ((uint32_t)len_buf_[1] << 8)
                    | ((uint32_t)len_buf_[2] << 16)
                    | ((uint32_t)len_buf_[3] << 24);

            // Validate length
            if (length_ > PROTO_MAX_DATA_LEN) {
                Serial.printf("[ERR] LENGTH too large: %u\n", length_);
                reset();
                return;
            }

            data_pos_ = 0;
            if (length_ == 0) {
                // No DATA, skip to CRC
                state_ = ProtoState::WAIT_CRC;
                crc_received_ = 0;
                crc_pos_ = 0;
            } else {
                state_ = ProtoState::WAIT_DATA;
            }
        }
        break;
    }

    case ProtoState::WAIT_DATA:
        data_buf_[data_pos_++] = byte;
        crc_calc_ = crc16_ccitt_update(crc_calc_, byte);

        if (data_pos_ >= length_) {
            state_ = ProtoState::WAIT_CRC;
            crc_received_ = 0;
            crc_pos_ = 0;
        }
        break;

    case ProtoState::WAIT_CRC: {
        // Accumulate 2-byte CRC (little-endian)
        if (crc_pos_ == 0) {
            // First CRC byte
            crc_received_ = byte;
            crc_pos_ = 1;
        } else {
            // Second CRC byte
            crc_received_ |= ((uint16_t)byte << 8);

            // Verify CRC
            if (crc_calc_ == crc_received_) {
                handleCompleteFrame();
            } else {
                Serial.printf("[ERR] CRC mismatch: calc=0x%04X recv=0x%04X\n", crc_calc_, crc_received_);
                // If this was a DATA frame, NAK with chunk_index from the payload
                if (cmd_ == CMD_DATA && length_ >= 2) {
                    uint16_t chunk_idx = (uint16_t)data_buf_[0] | ((uint16_t)data_buf_[1] << 8);
                    sendNak(chunk_idx);
                }
                reset();
            }
        }
        break;
    }
    } // switch
}

// ============================================================================
// Frame handler dispatcher
// ============================================================================

void BinaryProtocol::handleCompleteFrame() {
    switch (cmd_) {
    case CMD_PING:
        handlePingFrame();
        break;
    case CMD_BEGIN:
        handleBeginFrame();
        break;
    case CMD_DATA:
        handleDataFrame();
        break;
    case CMD_END:
        handleEndFrame();
        break;
    default:
        Serial.printf("[ERR] Unhandled CMD: 0x%02X\n", cmd_);
        break;
    }
    reset();
}

// ============================================================================
// PING handler
// ============================================================================

void BinaryProtocol::handlePingFrame() {
    sendPong();
}

// ============================================================================
// BEGIN handler
// ============================================================================

void BinaryProtocol::handleBeginFrame() {
    if (length_ < sizeof(BeginPayload)) {
        Serial.printf("[ERR] BEGIN payload too short: %u\n", length_);
        return;
    }

    // Reset any previous incomplete transfer
    if (transfer_.active) {
        Serial.println("[WRN] New BEGIN while transfer active, resetting");
        resetTransfer();
    }

    const BeginPayload *payload = reinterpret_cast<const BeginPayload*>(data_buf_);
    transfer_.total_size   = payload->total_size;
    transfer_.chunk_size   = payload->chunk_size;
    transfer_.total_chunks = payload->total_chunks;
    transfer_.received_bitmap = 0;
    transfer_.received_count  = 0;
    transfer_.active      = true;
    transfer_.begin_time  = millis();

    Serial.printf("[INF] Transfer BEGIN: total=%u chunk=%u chunks=%u\n",
        transfer_.total_size, transfer_.chunk_size, transfer_.total_chunks);

    // Acknowledge BEGIN
    sendAck(0);
}

// ============================================================================
// DATA handler
// ============================================================================

void BinaryProtocol::handleDataFrame() {
    if (!transfer_.active) {
        Serial.println("[ERR] DATA without BEGIN");
        return;
    }

    if (length_ < sizeof(DataPayloadHeader)) {
        Serial.printf("[ERR] DATA payload too short: %u\n", length_);
        return;
    }

    const DataPayloadHeader *hdr = reinterpret_cast<const DataPayloadHeader*>(data_buf_);
    uint16_t chunk_index = hdr->chunk_index;

    // Validate chunk_index
    if (chunk_index >= transfer_.total_chunks) {
        Serial.printf("[ERR] chunk_index %u >= total_chunks %u\n", chunk_index, transfer_.total_chunks);
        sendNak(chunk_index);
        return;
    }

    // Check if already received (duplicate)
    if (isChunkReceived(chunk_index)) {
        Serial.printf("[DBG] Duplicate chunk %u, ACK without write\n", chunk_index);
        sendAck(chunk_index);
        return;
    }

    // Calculate data offset and size
    uint16_t data_offset = sizeof(DataPayloadHeader);
    uint16_t chunk_data_len = length_ - data_offset;
    uint32_t psram_offset = (uint32_t)chunk_index * transfer_.chunk_size;

    // Validate chunk data length
    uint16_t expected_len = (chunk_index < transfer_.total_chunks - 1)
        ? transfer_.chunk_size
        : (transfer_.total_size - (uint32_t)(transfer_.total_chunks - 1) * transfer_.chunk_size);

    if (chunk_data_len != expected_len) {
        Serial.printf("[ERR] Chunk %u size mismatch: got %u expected %u\n",
            chunk_index, chunk_data_len, expected_len);
        sendNak(chunk_index);
        return;
    }

    // Write to PSRAM frame buffer
    memcpy(framebuf_ + psram_offset, data_buf_ + data_offset, chunk_data_len);

    // Mark received
    markChunkReceived(chunk_index);

    Serial.printf("[DBG] Chunk %u/%u written at offset %u (%u bytes)\n",
        chunk_index, transfer_.total_chunks - 1, psram_offset, chunk_data_len);

    sendAck(chunk_index);
}

// ============================================================================
// END handler
// ============================================================================

void BinaryProtocol::handleEndFrame() {
    if (!transfer_.active) {
        Serial.println("[ERR] END without BEGIN");
        return;
    }

    // Check if all chunks received
    if (transfer_.received_count < transfer_.total_chunks) {
        Serial.printf("[ERR] Transfer incomplete: %u/%u chunks\n",
            transfer_.received_count, transfer_.total_chunks);
        sendNak(0xFFFF);  // Generic NAK
        return;
    }

    Serial.println("[INF] Transfer complete, refreshing display...");

    // Trigger EPD refresh
    // Note: framebuf_ points to EPD's internal DispBuffer_, so data is already in place
    if (epd_ != nullptr) {
        epd_->EPD_Display();
        sendDisplayDone();
        Serial.println("[INF] Display refreshed.");
    } else {
        Serial.println("[ERR] EPD driver not available");
    }

    // Clear transfer state
    resetTransfer();
}

// ============================================================================
// Transfer state management
// ============================================================================

void BinaryProtocol::resetTransfer() {
    transfer_.active         = false;
    transfer_.total_size     = 0;
    transfer_.chunk_size     = 0;
    transfer_.total_chunks   = 0;
    transfer_.received_bitmap = 0;
    transfer_.received_count = 0;
    transfer_.begin_time     = 0;
}

bool BinaryProtocol::isChunkReceived(uint16_t index) const {
    if (index >= 64) return false;
    return (transfer_.received_bitmap >> index) & 1;
}

void BinaryProtocol::markChunkReceived(uint16_t index) {
    if (index >= 64) return;
    transfer_.received_bitmap |= (1ULL << index);
    transfer_.received_count++;
}

// ============================================================================
// Timeout handling
// ============================================================================

void BinaryProtocol::checkTimeouts() {
    unsigned long now = millis();

    // Frame-level timeout: no byte received for 5 seconds while in a frame
    if (state_ != ProtoState::IDLE && last_byte_time_ > 0) {
        if (now - last_byte_time_ > FRAME_BYTE_TIMEOUT_MS) {
            Serial.println("[ERR] Frame byte timeout, resetting");
            reset();
        }
    }

    // Transfer-level timeout: BEGIN received but no END within 60 seconds
    if (transfer_.active && transfer_.begin_time > 0) {
        if (now - transfer_.begin_time > TRANSFER_TIMEOUT_MS) {
            Serial.println("[ERR] Transfer timeout, discarding");
            reset();
            resetTransfer();
        }
    }
}

// ============================================================================
// Response send functions
// ============================================================================

void BinaryProtocol::sendPong() {
    uint8_t resp[] = {PROTO_MAGIC_0, PROTO_MAGIC_1, RESP_PONG};
    Serial.write(resp, sizeof(resp));
    Serial.flush();
}

void BinaryProtocol::sendAck(uint16_t chunk_index) {
    uint8_t resp[] = {
        PROTO_MAGIC_0, PROTO_MAGIC_1, RESP_ACK,
        (uint8_t)(chunk_index & 0xFF),
        (uint8_t)((chunk_index >> 8) & 0xFF)
    };
    Serial.write(resp, sizeof(resp));
    Serial.flush();
}

void BinaryProtocol::sendNak(uint16_t chunk_index) {
    uint8_t resp[] = {
        PROTO_MAGIC_0, PROTO_MAGIC_1, RESP_NAK,
        (uint8_t)(chunk_index & 0xFF),
        (uint8_t)((chunk_index >> 8) & 0xFF)
    };
    Serial.write(resp, sizeof(resp));
    Serial.flush();
}

void BinaryProtocol::sendDisplayDone() {
    uint8_t resp[] = {PROTO_MAGIC_0, PROTO_MAGIC_1, RESP_DISPLAY_DONE};
    Serial.write(resp, sizeof(resp));
    Serial.flush();
}
