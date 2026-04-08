## ADDED Requirements

### Requirement: EPD SPI communication

The driver SHALL communicate with the e-Paper display via SPI using ESP-IDF `spi_bus_initialize` and `spi_device_polling_transmit` APIs. The SPI bus SHALL be configured with MOSI, SCLK pins and no MISO. The SPI clock speed SHALL be 10 MHz.

#### Scenario: SPI bus initialization

- **WHEN** the EPD driver is constructed
- **THEN** SPI bus is initialized with the configured MOSI, SCLK pins, and a SPI device is added with 10 MHz clock, mode 0, half-duplex

### Requirement: EPD GPIO control

The driver SHALL control RST, DC, CS as output GPIOs and read BUSY as input GPIO. All output GPIOs SHALL be configured with pull-up enabled. BUSY GPIO SHALL be configured as input with pull-up enabled.

#### Scenario: GPIO pin configuration

- **WHEN** the EPD driver is constructed
- **THEN** RST, DC, CS pins are set as output with pull-up, and BUSY pin is set as input with pull-up

### Requirement: EPD hardware initialization

The driver SHALL send the official EPD_7IN3F initialization command sequence to configure the display. After initialization, the driver SHALL clear the display to white.

#### Scenario: Successful EPD initialization

- **WHEN** `EPD_Init()` is called
- **THEN** the RST pin is toggled (high→low→high with delays), BUSY is waited to go high, the complete register command sequence is sent, and the display is cleared to white

#### Scenario: Repeated initialization prevention

- **WHEN** `EPD_Init()` is called a second time without resetting
- **THEN** the initialization is skipped and a warning is logged

### Requirement: EPD display clear

The driver SHALL support clearing the frame buffer to a specified 4-bit color value and refreshing the display.

#### Scenario: Clear display to white

- **WHEN** `EPD_DispClear(ColorWhite)` is called
- **THEN** all bytes in the frame buffer are set to `0x11` (white=1, packed as 0x11), and the display is refreshed showing a white screen

### Requirement: EPD display refresh

The driver SHALL support sending the frame buffer content to the display and triggering a refresh. The refresh sequence SHALL include POWER_ON, second setting registers, DISPLAY_REFRESH, and POWER_OFF commands.

#### Scenario: Display refresh with pixel rotation

- **WHEN** `EPD_Display()` is called with rotation set to 3
- **THEN** the DispBuffer is rotated 90° CCW into RotationBuffer, RotationBuffer is sent via SPI command 0x10, and the display refresh sequence is executed

### Requirement: Frame buffer allocation in PSRAM

The driver SHALL allocate the frame buffer (192,000 bytes for 800×480 at 4-bit packed) in PSRAM using `heap_caps_malloc` with `MALLOC_CAP_SPIRAM`. A separate RotationBuffer of the same size SHALL also be allocated in PSRAM.

#### Scenario: PSRAM buffer allocation

- **WHEN** the EPD driver is constructed with width=800 and height=480
- **THEN** DispBuffer (192,000 bytes) and RotationBuffer (192,000 bytes) are allocated in PSRAM, and both pointers are non-null

### Requirement: Pixel rotation support

The driver SHALL support rotation modes 0 (none), 1 (90° CW), 2 (180°), and 3 (270°/90° CCW). The rotation operates on 4-bit packed pixel data.

#### Scenario: Rotation 3 (270°) for portrait mode

- **WHEN** `Set_Rotation(3)` is set and `EPD_Display()` is called with a 480×800 logical buffer
- **THEN** the buffer is rotated 90° CCW to produce the physical 800×480 output

### Requirement: Color enumeration consistency

The driver SHALL define a `ColorSelection` enum matching the Waveshare official enumeration: BLACK=0, WHITE=1, YELLOW=2, RED=3, (4=unused), BLUE=5, GREEN=6. The value 4 SHALL be explicitly skipped with `ColorBlue = 5`.

#### Scenario: Color values match official specification

- **WHEN** the `ColorSelection` enum is defined
- **THEN** `ColorBlack == 0`, `ColorWhite == 1`, `ColorYellow == 2`, `ColorRed == 3`, `ColorBlue == 5`, `ColorGreen == 6`, and index 4 has no enum value
