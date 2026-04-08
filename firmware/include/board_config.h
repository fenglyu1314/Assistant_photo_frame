#pragma once

#include <driver/gpio.h>

// ============================================================================
// EPD SPI Pins (Waveshare 7.3" 7-color e-Paper)
// ============================================================================
#define EPD_MOSI_PIN  GPIO_NUM_11
#define EPD_SCK_PIN   GPIO_NUM_10
#define EPD_CS_PIN    GPIO_NUM_9
#define EPD_DC_PIN    GPIO_NUM_8
#define EPD_RST_PIN   GPIO_NUM_12
#define EPD_BUSY_PIN  GPIO_NUM_13

// ============================================================================
// Button Pins
// ============================================================================
#define BTN_USER_PIN  GPIO_NUM_4   // USER / Page-flip button
#define BTN_BOOT_PIN  GPIO_NUM_0   // BOOT / Request-refresh button

// ============================================================================
// LED Pins
// ============================================================================
#define LED_GREEN_PIN GPIO_NUM_42
#define LED_RED_PIN   GPIO_NUM_45

// LED active level (LOW = ON for Waveshare board)
#define LED_ON  0
#define LED_OFF 1

// ============================================================================
// Display Constants
// ============================================================================
#define EPD_WIDTH  800   // Physical width
#define EPD_HEIGHT 480   // Physical height
// Logical (portrait) resolution with rotation=3: 480x800
