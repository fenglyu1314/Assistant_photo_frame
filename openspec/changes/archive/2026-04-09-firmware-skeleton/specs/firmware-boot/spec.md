## ADDED Requirements

### Requirement: Firmware startup sequence

The firmware SHALL initialize in the following order: Serial (USB CDC at 115200 baud), PSRAM, EPD driver (which initializes SPI and GPIO), and then perform an initial clear-to-white and display refresh.

#### Scenario: Normal startup

- **WHEN** the ESP32-S3 powers on
- **THEN** Serial is initialized at 115200 baud, PSRAM is confirmed available, the EPD driver is constructed and initialized, and the screen displays white

#### Scenario: PSRAM not available

- **WHEN** the ESP32-S3 powers on and PSRAM allocation fails
- **THEN** an error is logged via Serial and the firmware halts (assert failure)

### Requirement: Board pin configuration

The firmware SHALL define all hardware-specific GPIO pin assignments in a single `board_config.h` header file. The pin assignments SHALL match the Waveshare PhotoPainter hardware.

#### Scenario: Pin configuration matches hardware

- **WHEN** `board_config.h` is included
- **THEN** EPD SPI pins are: MOSI=11, SCK=10, CS=9, DC=8, RST=12, BUSY=13; button pins: USER=GPIO4, BOOT=GPIO0; LED pins: GREEN=GPIO42, RED=GPIO45

### Requirement: LED indicator on startup

The firmware SHALL turn on the green LED during EPD initialization/refresh and turn it off when complete, providing visual feedback of the startup process.

#### Scenario: Green LED blinks during startup

- **WHEN** the firmware starts and begins EPD initialization
- **THEN** the green LED is turned on, and after the display refresh completes, the green LED is turned off

### Requirement: Arduino-style entry points

The firmware SHALL use Arduino-style `setup()` and `loop()` functions. The `setup()` function performs all initialization. The `loop()` function remains empty (awaiting Phase 2 protocol implementation).

#### Scenario: Setup and loop execution

- **WHEN** the firmware runs
- **THEN** `setup()` is called once and completes initialization, then `loop()` is called repeatedly but does nothing
