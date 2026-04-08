#pragma once

#include <Arduino.h>

/**
 * CRC-16/CCITT (poly=0x1021, init=0x0000)
 * Covers: CMD + LENGTH + DATA
 */
uint16_t crc16_ccitt(const uint8_t *data, size_t length);

/**
 * Incremental CRC-16/CCITT calculation
 */
uint16_t crc16_ccitt_update(uint16_t crc, uint8_t byte);
