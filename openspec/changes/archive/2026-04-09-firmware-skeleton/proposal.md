## Why

项目目前只有文档和参考资料，没有任何可编译运行的代码。需要创建 ESP32-S3 固件的最小骨架，使硬件能启动、初始化墨水屏并清屏，为后续的二进制协议和帧缓冲区接收奠定基础。

## What Changes

- 创建 `firmware/` 目录及 PlatformIO 项目结构（`platformio.ini`、`src/`、`lib/`、`include/`）
- 从官方仓库移植 EPaperDriver 墨水屏 SPI 驱动（`lib/EPaperDriver/`）
- 创建 `board_config.h` 硬件引脚配置
- 创建最小 `main.cpp`：初始化串口、PSRAM、EPD 驱动，清屏为白色
- 固件编译验证通过（`pio run`）

## Capabilities

### New Capabilities

- `epd-driver`: 墨水屏 SPI 驱动能力——封装 Waveshare 7.3" 7色 e-Paper 的初始化、清屏、刷新操作，适配 ESP32-S3 引脚配置
- `firmware-boot`: 固件启动能力——ESP32-S3 上电初始化（串口、PSRAM、EPD），执行清屏并进入待机状态

### Modified Capabilities

（无——这是项目的第一个 Change）

## Impact

- **新增文件**: `firmware/` 整个目录（~10 个文件）
- **影响模块**: 仅 firmware，不涉及 companion
- **协议变更**: 无（此阶段不实现通信协议）
- **依赖**: 需要参考 `Reference/ESP32-S3-PhotoPainter-main/` 中的 EPaperDriver 驱动代码
