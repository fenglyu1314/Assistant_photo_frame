#include <Arduino.h>
#include "board_config.h"
#include "protocol.h"
#include "EPaperDriver.h"
#include "BinaryProtocol.h"

static ePaperPort *epd = nullptr;
static BinaryProtocol *proto = nullptr;

void setup() {
    // Expand RX buffer BEFORE Serial.begin
    Serial.setRxBufferSize(RX_BUFFER_SIZE);
    Serial.begin(115200);
    delay(100);
    Serial.println("[Assistant Photo Frame] Firmware starting...");

    // Initialize LED pins
    gpio_config_t led_conf = {};
    led_conf.intr_type = GPIO_INTR_DISABLE;
    led_conf.mode = GPIO_MODE_OUTPUT;
    led_conf.pin_bit_mask = (0x1ULL << LED_GREEN_PIN) | (0x1ULL << LED_RED_PIN);
    led_conf.pull_down_en = GPIO_PULLDOWN_DISABLE;
    led_conf.pull_up_en = GPIO_PULLUP_ENABLE;
    ESP_ERROR_CHECK_WITHOUT_ABORT(gpio_config(&led_conf));

    // Green LED ON: firmware working
    gpio_set_level(LED_GREEN_PIN, LED_ON);
    gpio_set_level(LED_RED_PIN, LED_OFF);

    // Construct EPD driver with rotation=3 (portrait 480x800)
    epd = new ePaperPort(
        EPD_MOSI_PIN, EPD_SCK_PIN, EPD_DC_PIN,
        EPD_CS_PIN, EPD_RST_PIN, EPD_BUSY_PIN,
        EPD_WIDTH, EPD_HEIGHT, SPI3_HOST
    );
    epd->Set_Rotation(3);

    Serial.println("[EPD] Initializing...");
    epd->EPD_Init();
    Serial.println("[EPD] Init complete, displaying white screen...");

    // Clear screen to white and display
    epd->EPD_DispClear(ColorWhite);
    epd->EPD_Display();
    Serial.println("[EPD] White screen displayed.");

    // Initialize binary protocol (uses EPD's internal PSRAM frame buffer)
    proto = new BinaryProtocol(epd, epd->EPD_GetIMGBuffer());
    Serial.println("[Protocol] Binary protocol initialized.");

    // Green LED OFF: init complete
    gpio_set_level(LED_GREEN_PIN, LED_OFF);

    Serial.println("[Assistant Photo Frame] Setup complete.");
}

void loop() {
    if (proto) {
        proto->process();
    }
    // Small yield to prevent watchdog
    delay(1);
}
