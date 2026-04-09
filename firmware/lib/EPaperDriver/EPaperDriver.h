#pragma once

#include <driver/gpio.h>
#include <driver/spi_master.h>
#include <cstdint>

// Color enumeration matching Waveshare official EPD_7IN3F
// Index 4 is explicitly skipped (no ColorOrange)
enum ColorSelection {
    ColorBlack  = 0,
    ColorWhite  = 1,
    ColorYellow = 2,
    ColorRed    = 3,
    // 4 = unused
    ColorBlue   = 5,
    ColorGreen  = 6
};

class ePaperPort {
public:
    ePaperPort(int mosi, int scl, int dc, int cs, int rst, int busy,
               int width, int height,
               spi_host_device_t spihost = SPI3_HOST);
    ~ePaperPort();

    void EPD_Init();
    void EPD_DispClear(uint8_t color);
    void EPD_Display();
    void EPD_DisplayRaw();   // Send DispBuffer_ directly (no rotation) for pre-rotated data
    void Set_Rotation(uint8_t rot);
    uint8_t* EPD_GetIMGBuffer();

private:
    // SPI
    spi_device_handle_t spi_;
    int mosi_;
    int scl_;
    int dc_;
    int cs_;
    int rst_;
    int busy_;
    int width_;
    int height_;

    // Display dimensions in 4-bit packed format
    int dispwidth_;   // width / 2 (bytes per row)
    int dispheight_;  // height
    int display_len_; // dispwidth_ * dispheight_

    // Buffers (allocated in PSRAM)
    uint8_t *DispBuffer_     = nullptr;
    uint8_t *RotationBuffer_ = nullptr;

    // State
    uint8_t rotation_  = 0;  // 0=none, 1=90CW, 2=180, 3=270(90CCW)
    bool is_epd_init_  = false;
    const char *TAG_   = "EPD";

    // GPIO helpers
    void SetResetLevel(bool level);
    void SetCSLevel(bool level);
    void SetDCLevel(bool level);
    bool GetBusyLevel();

    // EPD low-level
    void EPD_Reset();
    void EPD_LoopBusy();
    void SPI_Write(uint8_t data);
    void EPD_SendCommand(uint8_t reg);
    void EPD_SendData(uint8_t data);
    void EPD_SendBuffer(uint8_t *data, int len);
    void EPD_TurnOnDisplay();

    // Pixel helpers (4-bit packed)
    static uint8_t EPD_GetPixel4(const uint8_t *buf, int width, int x, int y);
    static void EPD_SetPixel4(uint8_t *buf, int width, int x, int y, uint8_t px);

    // Rotation
    void EPD_PixelRotate();
    void EPD_Rotate90CCW_Fast(const uint8_t *src, uint8_t *dst, int width, int height);
    void EPD_Rotate90CW_Fast(const uint8_t *src, uint8_t *dst, int width, int height);
    void EPD_Rotate180_Fast(const uint8_t *src, uint8_t *dst, int width, int height);
};
