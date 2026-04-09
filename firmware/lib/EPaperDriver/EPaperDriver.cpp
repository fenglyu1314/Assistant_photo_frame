#include "EPaperDriver.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <esp_log.h>
#include <cstring>

// ============================================================================
// GPIO helpers
// ============================================================================

void ePaperPort::SetResetLevel(bool level) {
    gpio_set_level((gpio_num_t)rst_, level ? 1 : 0);
}

void ePaperPort::SetCSLevel(bool level) {
    gpio_set_level((gpio_num_t)cs_, level ? 1 : 0);
}

void ePaperPort::SetDCLevel(bool level) {
    gpio_set_level((gpio_num_t)dc_, level ? 1 : 0);
}

bool ePaperPort::GetBusyLevel() {
    return gpio_get_level((gpio_num_t)busy_) != 0;
}

// ============================================================================
// EPD low-level
// ============================================================================

void ePaperPort::EPD_Reset() {
    SetResetLevel(true);
    vTaskDelay(pdMS_TO_TICKS(50));
    SetResetLevel(false);
    vTaskDelay(pdMS_TO_TICKS(20));
    SetResetLevel(true);
    vTaskDelay(pdMS_TO_TICKS(50));
}

void ePaperPort::EPD_LoopBusy() {
    while (true) {
        if (GetBusyLevel()) {
            return;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

void ePaperPort::SPI_Write(uint8_t data) {
    esp_err_t ret;
    spi_transaction_t t;
    memset(&t, 0, sizeof(t));
    t.length = 8;
    t.tx_buffer = &data;
    ret = spi_device_polling_transmit(spi_, &t);
    assert(ret == ESP_OK);
}

void ePaperPort::EPD_SendCommand(uint8_t reg) {
    SetDCLevel(false);
    SetCSLevel(false);
    SPI_Write(reg);
    SetCSLevel(true);
}

void ePaperPort::EPD_SendData(uint8_t data) {
    SetDCLevel(true);
    SetCSLevel(false);
    SPI_Write(data);
    SetCSLevel(true);
}

void ePaperPort::EPD_SendBuffer(uint8_t *data, int len) {
    SetDCLevel(true);
    SetCSLevel(false);
    esp_err_t ret;
    spi_transaction_t t;
    memset(&t, 0, sizeof(t));
    int len_scl = len / 5000;
    int len_dcl = len % 5000;
    uint8_t *ptr = data;
    while (len_scl) {
        t.length = 8 * 5000;
        t.tx_buffer = ptr;
        ret = spi_device_polling_transmit(spi_, &t);
        assert(ret == ESP_OK);
        len_scl--;
        ptr += 5000;
    }
    t.length = 8 * len_dcl;
    t.tx_buffer = ptr;
    ret = spi_device_polling_transmit(spi_, &t);
    assert(ret == ESP_OK);
    SetCSLevel(true);
}

void ePaperPort::EPD_TurnOnDisplay() {
    EPD_SendCommand(0x04);  // POWER_ON
    EPD_LoopBusy();

    // Second setting
    EPD_SendCommand(0x06);
    EPD_SendData(0x6F);
    EPD_SendData(0x1F);
    EPD_SendData(0x17);
    EPD_SendData(0x49);

    EPD_SendCommand(0x12);  // DISPLAY_REFRESH
    EPD_SendData(0x00);
    EPD_LoopBusy();

    EPD_SendCommand(0x02);  // POWER_OFF
    EPD_SendData(0x00);
    EPD_LoopBusy();
}

// ============================================================================
// 4-bit packed pixel helpers
// ============================================================================

uint8_t ePaperPort::EPD_GetPixel4(const uint8_t *buf, int width, int x, int y) {
    int index = y * (width >> 1) + (x >> 1);
    uint8_t byte = buf[index];
    return (x & 1) ? (byte & 0x0F) : (byte >> 4);
}

void ePaperPort::EPD_SetPixel4(uint8_t *buf, int width, int x, int y, uint8_t px) {
    int index = y * (width >> 1) + (x >> 1);
    uint8_t old = buf[index];
    if (x & 1)
        buf[index] = (old & 0xF0) | (px & 0x0F);
    else
        buf[index] = (old & 0x0F) | (px << 4);
}

// ============================================================================
// Rotation
// ============================================================================

void ePaperPort::EPD_Rotate90CCW_Fast(const uint8_t *src, uint8_t *dst, int width, int height) {
    const int srcBytesPerRow = width >> 1;
    for (int y = 0; y < height; y++) {
        const uint8_t *srcRow = src + y * srcBytesPerRow;
        for (int x = 0; x < width; x += 2) {
            uint8_t b = srcRow[x >> 1];
            uint8_t p0 = b >> 4;
            uint8_t p1 = b & 0x0F;
            int ny0 = width - 1 - x;
            int nx0 = y;
            int ny1 = width - 2 - x;
            int nx1 = y;
            EPD_SetPixel4(dst, height, nx0, ny0, p0);
            EPD_SetPixel4(dst, height, nx1, ny1, p1);
        }
    }
}

void ePaperPort::EPD_Rotate90CW_Fast(const uint8_t *src, uint8_t *dst, int width, int height) {
    const int srcBytesPerRow = width >> 1;
    for (int y = 0; y < height; y++) {
        const uint8_t *srcRow = src + y * srcBytesPerRow;
        for (int x = 0; x < width; x += 2) {
            uint8_t b = srcRow[x >> 1];
            uint8_t p0 = b >> 4;
            uint8_t p1 = b & 0x0F;
            int ny0 = x;
            int nx0 = height - 1 - y;
            int ny1 = x + 1;
            int nx1 = height - 1 - y;
            EPD_SetPixel4(dst, height, nx0, ny0, p0);
            EPD_SetPixel4(dst, height, nx1, ny1, p1);
        }
    }
}

void ePaperPort::EPD_Rotate180_Fast(const uint8_t *src, uint8_t *dst, int width, int height) {
    const int bytesPerRow = width >> 1;
    const int totalRows = height;
    for (int y = 0; y < totalRows; y++) {
        const uint8_t *srcRow = src + y * bytesPerRow;
        uint8_t *dstRow = dst + (totalRows - 1 - y) * bytesPerRow;
        for (int x = 0; x < bytesPerRow; x++) {
            uint8_t b = srcRow[x];
            b = (b << 4) | (b >> 4);
            dstRow[bytesPerRow - 1 - x] = b;
        }
    }
}

void ePaperPort::EPD_PixelRotate() {
    if (rotation_ == 3) {
        // rotation=3: DispBuffer is 480x800, rotate 90CCW to 800x480
        EPD_Rotate90CCW_Fast(DispBuffer_, RotationBuffer_, 480, 800);
    } else if (rotation_ == 1) {
        EPD_Rotate90CW_Fast(DispBuffer_, RotationBuffer_, 480, 800);
    } else if (rotation_ == 2) {
        EPD_Rotate180_Fast(DispBuffer_, RotationBuffer_, 800, 480);
    } else {
        memcpy(RotationBuffer_, DispBuffer_, display_len_);
    }
}

// ============================================================================
// Constructor / Destructor
// ============================================================================

ePaperPort::ePaperPort(int mosi, int scl, int dc, int cs, int rst, int busy,
                       int width, int height,
                       spi_host_device_t spihost)
    : mosi_(mosi), scl_(scl), dc_(dc), cs_(cs), rst_(rst), busy_(busy),
      width_(width), height_(height) {

    esp_err_t ret;
    spi_bus_config_t buscfg = {};
    int transfer = width_ * height_;

    // 4-bit packed dimensions
    dispwidth_ = width_ / 2;    // bytes per row
    dispheight_ = height_;
    display_len_ = dispwidth_ * dispheight_;

    // Allocate frame buffers in PSRAM
    DispBuffer_ = (uint8_t *)heap_caps_malloc(display_len_, MALLOC_CAP_SPIRAM);
    assert(DispBuffer_);

    RotationBuffer_ = (uint8_t *)heap_caps_malloc(display_len_, MALLOC_CAP_SPIRAM);
    assert(RotationBuffer_);

    // SPI bus configuration
    buscfg.miso_io_num = -1;
    buscfg.mosi_io_num = mosi;
    buscfg.sclk_io_num = scl;
    buscfg.quadwp_io_num = -1;
    buscfg.quadhd_io_num = -1;
    buscfg.max_transfer_sz = transfer;

    // SPI device configuration (10 MHz, mode 0, half-duplex)
    spi_device_interface_config_t devcfg = {};
    devcfg.spics_io_num = -1;  // CS managed manually via GPIO
    devcfg.clock_speed_hz = 10 * 1000 * 1000;
    devcfg.mode = 0;
    devcfg.queue_size = 7;
    devcfg.flags = SPI_DEVICE_HALFDUPLEX;

    ret = spi_bus_initialize(spihost, &buscfg, SPI_DMA_CH_AUTO);
    ESP_ERROR_CHECK(ret);
    ret = spi_bus_add_device(spihost, &devcfg, &spi_);
    ESP_ERROR_CHECK(ret);

    // Configure output GPIOs: RST, DC, CS
    gpio_config_t gpio_conf = {};
    gpio_conf.intr_type = GPIO_INTR_DISABLE;
    gpio_conf.mode = GPIO_MODE_OUTPUT;
    gpio_conf.pin_bit_mask = (0x1ULL << rst_) | (0x1ULL << dc_) | (0x1ULL << cs_);
    gpio_conf.pull_down_en = GPIO_PULLDOWN_DISABLE;
    gpio_conf.pull_up_en = GPIO_PULLUP_ENABLE;
    ESP_ERROR_CHECK_WITHOUT_ABORT(gpio_config(&gpio_conf));

    // Configure input GPIO: BUSY
    gpio_conf.intr_type = GPIO_INTR_DISABLE;
    gpio_conf.mode = GPIO_MODE_INPUT;
    gpio_conf.pin_bit_mask = (0x1ULL << busy_);
    gpio_conf.pull_down_en = GPIO_PULLDOWN_DISABLE;
    gpio_conf.pull_up_en = GPIO_PULLUP_ENABLE;
    ESP_ERROR_CHECK_WITHOUT_ABORT(gpio_config(&gpio_conf));

    // Default: RST high (idle)
    SetResetLevel(true);

    ESP_LOGI(TAG_, "ePaperPort constructed: %dx%d, dispwidth=%d, display_len=%d",
             width_, height_, dispwidth_, display_len_);
}

ePaperPort::~ePaperPort() {
    if (DispBuffer_) {
        heap_caps_free(DispBuffer_);
        DispBuffer_ = nullptr;
    }
    if (RotationBuffer_) {
        heap_caps_free(RotationBuffer_);
        RotationBuffer_ = nullptr;
    }
}

// ============================================================================
// Public API
// ============================================================================

void ePaperPort::EPD_Init() {
    if (is_epd_init_) {
        ESP_LOGW(TAG_, "EPD already initialized, skipping");
        return;
    }

    EPD_Reset();
    EPD_LoopBusy();
    vTaskDelay(pdMS_TO_TICKS(50));

    // Register init sequence from official Waveshare EPD_7IN3F driver
    EPD_SendCommand(0xAA);
    EPD_SendData(0x49);
    EPD_SendData(0x55);
    EPD_SendData(0x20);
    EPD_SendData(0x08);
    EPD_SendData(0x09);
    EPD_SendData(0x18);

    EPD_SendCommand(0x01);
    EPD_SendData(0x3F);

    EPD_SendCommand(0x00);
    EPD_SendData(0x5F);
    EPD_SendData(0x69);

    EPD_SendCommand(0x03);
    EPD_SendData(0x00);
    EPD_SendData(0x54);
    EPD_SendData(0x00);
    EPD_SendData(0x44);

    EPD_SendCommand(0x05);
    EPD_SendData(0x40);
    EPD_SendData(0x1F);
    EPD_SendData(0x1F);
    EPD_SendData(0x2C);

    EPD_SendCommand(0x06);
    EPD_SendData(0x6F);
    EPD_SendData(0x1F);
    EPD_SendData(0x17);
    EPD_SendData(0x49);

    EPD_SendCommand(0x08);
    EPD_SendData(0x6F);
    EPD_SendData(0x1F);
    EPD_SendData(0x1F);
    EPD_SendData(0x22);

    EPD_SendCommand(0x30);
    EPD_SendData(0x03);

    EPD_SendCommand(0x50);
    EPD_SendData(0x3F);

    EPD_SendCommand(0x60);
    EPD_SendData(0x02);
    EPD_SendData(0x00);

    EPD_SendCommand(0x61);
    EPD_SendData(0x03);
    EPD_SendData(0x20);
    EPD_SendData(0x01);
    EPD_SendData(0xE0);

    EPD_SendCommand(0x84);
    EPD_SendData(0x01);

    EPD_SendCommand(0xE3);
    EPD_SendData(0x2F);

    EPD_SendCommand(0x04);  // POWER_ON
    EPD_LoopBusy();

    // Clear to white on init (matching official driver behavior)
    EPD_DispClear(ColorWhite);
    EPD_Display();

    is_epd_init_ = true;
    ESP_LOGI(TAG_, "EPD initialized successfully");
}

void ePaperPort::EPD_DispClear(uint8_t color) {
    uint8_t packed = (color << 4) | color;
    memset(DispBuffer_, packed, display_len_);
}

void ePaperPort::EPD_Display() {
    EPD_PixelRotate();
    EPD_SendCommand(0x10);
    EPD_SendBuffer(RotationBuffer_, display_len_);
    EPD_TurnOnDisplay();
}

void ePaperPort::EPD_DisplayRaw() {
    // Send DispBuffer_ directly without rotation.
    // Used when the buffer already contains data in physical (800x480) format,
    // e.g. pre-rotated data received from the PC companion app.
    EPD_SendCommand(0x10);
    EPD_SendBuffer(DispBuffer_, display_len_);
    EPD_TurnOnDisplay();
}

void ePaperPort::Set_Rotation(uint8_t rot) {
    rotation_ = rot;
    ESP_LOGI(TAG_, "Rotation set to %d", rotation_);
}

uint8_t* ePaperPort::EPD_GetIMGBuffer() {
    return DispBuffer_;
}
