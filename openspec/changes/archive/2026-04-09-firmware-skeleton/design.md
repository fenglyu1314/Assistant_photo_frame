## Context

项目目前只有文档和参考资料，没有可编译运行的代码。官方仓库 (`Reference/ESP32-S3-PhotoPainter-main/`) 提供了两个版本的 EPD 驱动：

- **完整版** (ESP-IDF 框架，`display_bsp.h/.cpp`)：使用 ESP-IDF SPI 驱动 API，支持 4bpp 像素缓冲、旋转、图片解码抖动。依赖 `ImgDecodeDither` 类，构造函数参数多。
- **简化版** (Arduino 兼容，`bsp_fac.h`)：也使用 ESP-IDF SPI 驱动，但 API 更简洁，3bpp 颜色映射，默认 180 度旋转。不依赖图片解码库。

我们的项目使用 **PlatformIO + Arduino Framework**，ESP32 只做「帧缓冲区显示器」，不需要 SD 卡、图片解码、抖动等功能。因此需要从参考代码中提取核心 SPI 通信和初始化逻辑，适配到 Arduino 框架和我们的架构。

## Goals / Non-Goals

**Goals:**

- 创建可编译的 PlatformIO 固件项目
- 移植 EPD 驱动，能在 Arduino 框架下初始化墨水屏并清屏
- 帧缓冲区分配在 PSRAM（192KB，4-bit packed）
- 引脚配置集中管理在 `board_config.h`
- 为 Phase 2 的二进制协议预留帧缓冲区访问接口

**Non-Goals:**

- 不实现串口协议（Phase 2）
- 不实现图片解码、抖动、SD 卡功能
- 不实现文字渲染、字体支持
- 不实现低功耗/深睡眠模式
- 不实现按键处理逻辑

## Decisions

### D1: 使用简化版 EPD 驱动作为移植基础

| 方案 | 结论 |
|------|------|
| A: 基于简化版 (`bsp_fac.h`) 移植 | ✅ 选用 |
| B: 基于完整版 (`display_bsp.h`) 移植 | ❌ |

**理由**：简化版 API 更简洁，不依赖 `ImgDecodeDither`，且同样使用 ESP-IDF SPI 驱动 API。我们的架构中 ESP32 只接收帧缓冲区数据并刷屏，不需要图片解码能力。完整版的大量代码（BMP 解析、缩放、抖动、中英文字体渲染）都用不上。

### D2: 帧缓冲区使用 4-bit packed 格式

| 方案 | 结论 |
|------|------|
| A: 4-bit packed (1 byte = 2 pixels) | ✅ 选用 |
| B: 1 byte = 1 pixel | ❌ |

**理由**：与官方驱动和 桌面端的量化引擎保持一致。4-bit packed 格式下 800×480 的帧缓冲区为 192,000 字节，刚好适配 PSRAM。官方驱动的 `EPD_Sendbuffera` 直接发送 packed 数据到屏幕。

### D3: rotation=3 (270°) 为默认旋转

竖屏逻辑分辨率 480×800，物理分辨率 800×480。DispBuffer 以 480×800 布局（4-bit packed，每行 240 字节，共 800 行 = 192,000 字节），显示时通过 `EPD_PixelRotate()` 旋转 90°CCW 到物理 800×480 写入 RotationBuffer，再发送到屏幕。

这与官方完整版驱动的行为一致（`Rotation = 3` 时调用 `EPD_Rotate90CCW_Fast`）。

### D4: SPI 时钟频率

| 方案 | 结论 |
|------|------|
| A: 10 MHz（简化版默认） | ✅ 选用 |
| B: 40 MHz（完整版默认） | ❌ |

**理由**：10 MHz 更保守稳定。Phase 1 的目标是验证能工作，后续可调高。完整版用 40 MHz 是因为要快速加载大图，而我们的场景由 桌面端推送，刷屏速度不是首要关注点。

### D5: 在 Arduino 框架下使用 ESP-IDF SPI API

官方两个版本都使用 `spi_bus_initialize` / `spi_device_polling_transmit` 等 ESP-IDF API，而非 Arduino 的 `SPI` 库。在 PlatformIO Arduino 框架下，ESP-IDF API 同样可用。直接复用这些 API 可以保证与官方驱动行为一致。

## Risks / Trade-offs

- **[Arduino + ESP-IDF SPI 混用]** → PlatformIO Arduino 框架下 ESP-IDF API 可用，但需确保 `platformio.ini` 正确配置 PSRAM 和 Flash 模式
- **[简化版驱动未在 rotation=3 下验证]** → 简化版默认 Rotate=180，但旋转逻辑代码与完整版一致，风险可控。需在烧录后实际验证竖屏显示
- **[EPD 初始化命令序列]** → 直接复制官方驱动的寄存器命令序列，不深入理解每个寄存器含义。这是黑盒操作，但官方代码已在实际硬件上验证
