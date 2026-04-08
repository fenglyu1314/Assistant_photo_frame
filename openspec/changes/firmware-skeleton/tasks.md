## 1. 项目脚手架

- [x] 1.1 创建 `firmware/` 目录，初始化 PlatformIO 项目（`platformio.ini` 配置 ESP32-S3, 16MB Flash QIO, 8MB PSRAM OPI, Arduino Framework）
- [x] 1.2 创建 `firmware/include/` 目录，添加 `board_config.h` 引脚配置（EPD SPI: MOSI=11, SCK=10, CS=9, DC=8, RST=12, BUSY=13; 按键: USER=GPIO4, BOOT=GPIO0; LED: GREEN=GPIO42, RED=GPIO45）

## 2. EPD 驱动移植

- [x] 2.1 创建 `firmware/lib/EPaperDriver/` 目录，编写 `EPaperDriver.h`：定义 `ColorSelection` 枚举（BLACK=0, WHITE=1, YELLOW=2, RED=3, BLUE=5, GREEN=6）、`ePaperPort` 类声明（构造函数、EPD_Init、EPD_DispClear、EPD_Display、Set_Rotation、EPD_GetIMGBuffer 等公共方法）
- [x] 2.2 编写 `EPaperDriver.cpp`：实现构造函数（SPI 总线初始化、GPIO 配置、PSRAM 帧缓冲区分配），参考官方 `bsp_fac.h` 的简化版驱动
- [x] 2.3 实现 EPD 硬件初始化（`EPD_Init`）：Reset 时序 + BUSY 等待 + 完整寄存器命令序列（复制官方 `bsp_fac.h` 中的命令），含重复初始化保护
- [x] 2.4 实现 SPI 通信方法：`SPI_Write`、`EPD_SendCommand`、`EPD_SendData`、`EPD_SendBuffer`（分块发送，每块最大 5000 字节）
- [x] 2.5 实现 `EPD_DispClear`：将帧缓冲区填充为指定颜色（4-bit packed），`EPD_Display`：像素旋转 + 发送缓冲区 + 刷新序列
- [x] 2.6 实现像素旋转方法：`EPD_Rotate90CCW_Fast`、`EPD_Rotate90CW_Fast`、`EPD_Rotate180_Fast`、`EPD_PixelRotate`、`EPD_SetPixel4`、`EPD_GetPixel4`，参考官方 `display_bsp.cpp` 实现

## 3. 主程序

- [x] 3.1 编写 `firmware/src/main.cpp`：`setup()` 中初始化 Serial (115200)、点亮绿色 LED、构造 ePaperPort 实例（rotation=3）、调用 EPD_Init + EPD_DispClear(White) + EPD_Display、熄灭绿色 LED；`loop()` 为空

## 4. 编译验证

- [x] 4.1 执行 `pio run` 编译通过（用户手动执行）
- [x] 4.2 烧录到 ESP32-S3，验证屏幕初始化并清屏为白色（用户手动执行）
