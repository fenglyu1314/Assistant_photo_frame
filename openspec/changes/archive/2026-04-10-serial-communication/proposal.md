## Why

桌面端（Phase 3）和量化引擎（Phase 4）已就绪，固件端二进制协议（Phase 2）也已完成。但 桌面端目前无法与 ESP32 通信——缺少串口发现、连接管理和二进制协议编码/发送能力。Phase 5 将补齐这一关键链路，使 Electron 能通过 USB CDC 串口发现 ESP32、建立连接、发送 192KB 帧缓冲区并接收固件响应。

## What Changes

- **新增 `serialport` 依赖**：安装 serialport npm 包，配置 electron-rebuild 编译原生模块
- **新增 `electron/serial/serial-manager.ts`**：自动扫描 VID=0x303A 的 USB CDC 设备、连接/断开/自动重连、设备状态事件
- **新增 `electron/serial/binary-protocol.ts`**：CRC-16/CCITT 计算、帧构建（MAGIC+CMD+LENGTH+DATA+CRC）、BEGIN/DATA/END 分块发送、PING/PONG 心跳
- **新增 `electron/serial/response-parser.ts`**：从串口字节流中解析 ESP32 响应（PONG/ACK/NAK/DISPLAY_DONE）
- **新增 IPC 通道注册**：在 `electron/main.ts` 注册 `serial:scan`、`serial:connect`、`serial:disconnect`、`serial:send-buffer`、`serial:ping` 等 ipcMain.handle 处理器
- **更新 preload IPC 桥接**：在 `electron/preload.ts` 增加 `off`/`removeListener` 方法防止内存泄漏
- **新增单元测试**：CRC 计算、帧构建、响应解析的 Vitest 测试

## Capabilities

### New Capabilities
- `serial-manager`: 串口自动扫描（VID 过滤）、连接管理（打开/关闭/自动重连）、设备状态事件广播
- `binary-protocol-encoder`: 桌面端二进制帧编码器 — CRC-16/CCITT、帧构建、192KB 分块传输流程（BEGIN→DATA×47→END）、逐块 ACK/NAK 确认、PING/PONG 心跳
- `serial-ipc-bridge`: 主进程串口功能到渲染进程的 IPC 通道桥接

### Modified Capabilities
- `electron-app-shell`: 主进程新增 ipcMain.handle 注册（串口操作通道）；preload 增加 listener 清理方法

## Impact

- **companion/package.json**: 新增 `serialport` 依赖
- **companion/electron/serial/**: 新增目录，3 个 TypeScript 模块
- **companion/electron/main.ts**: 新增 IPC handler 注册和串口生命周期管理
- **companion/electron/preload.ts**: 增加 `off` 方法
- **companion/src/env.d.ts**: 更新 `window.api` 类型声明
- **companion/electron.vite.config.ts**: 可能需要调整 external 配置
- **不涉及固件变更** — 固件端协议已在 Phase 2 完成
- **不涉及协议变更** — 完全对齐已有的 `protocol.h` 定义
