## Why

ESP32 固件当前只能清屏，无法从 桌面端接收帧缓冲区数据。需要实现二进制帧协议，使 ESP32 能接收 桌面端发送的 192KB 帧缓冲区并驱动墨水屏刷新，这是整个渲染管线的核心通信基础。

## What Changes

- 新增 `protocol.h`：定义二进制帧协议常量（MAGIC `0xEB0D`、CMD 枚举、帧结构）
- 新增 `crc16.h/.cpp`：CRC-16/CCITT 校验工具函数
- 新增 `BinaryProtocol.h/.cpp`：二进制帧接收状态机，支持 MAGIC 检测、帧解析、CRC 校验
- 新增分块传输处理：BEGIN→DATA×47→END 流程，逐块 ACK/NAK 确认，流式写入 PSRAM
- 新增 PING/PONG 心跳机制（CMD=0xFF）
- 修改 `main.cpp`：集成协议处理到 loop()，接收完成后触发刷屏
- 修改 `Serial.setRxBufferSize(8192)`：扩大 RX 缓冲区以支持 4KB 分块

## Capabilities

### New Capabilities
- `binary-frame-protocol`: 二进制帧协议定义（帧结构、CMD 类型、CRC 校验、分块传输流程）
- `firmware-protocol-handler`: ESP32 端协议处理（状态机、PSRAM 流式写入、刷屏触发、PING/PONG）

### Modified Capabilities

（无——firmware-boot spec 的需求不变，只是 main.cpp 集成新的协议处理逻辑）

## Impact

- **firmware/ 模块**：新增 `lib/SerialProtocol/BinaryProtocol.{h,cpp}`、`lib/SerialProtocol/crc16.{h,cpp}`、`include/protocol.h`；修改 `src/main.cpp`
- **串口通信协议**：定义新的二进制帧协议，后续 Phase 5（Electron 串口通信）将实现编码端
- **PSRAM 使用**：帧缓冲区在 PSRAM 中分配，分块传输时边收边写
- **无 breaking change**：当前固件只有清屏功能，不存在旧协议兼容问题
