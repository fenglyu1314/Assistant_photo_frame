## Context

Electron 伴侣应用骨架（Phase 3）已搭建完成：主进程窗口管理、系统托盘、preload IPC 桥接均可用。量化引擎（Phase 4）可将 RGBA 像素数据转为 192KB 物理帧缓冲区。固件端（Phase 2）的 BinaryProtocol 状态机已实现，能接收二进制帧、写入 PSRAM、刷屏。

缺失的关键环节是 **PC → ESP32 的通信链路**：串口发现、连接管理、二进制帧编码发送、响应解析。本设计填补这一空白。

**当前代码状态：**
- `companion/electron/main.ts`：有窗口+托盘+更新，无 IPC handler、无串口逻辑
- `companion/electron/preload.ts`：暴露 invoke/send/on，缺少 off（listener 清理）
- `companion/electron.vite.config.ts`：已在 rollupOptions.external 中声明 `serialport`，但包未安装
- `tools/test_protocol.js`：已有可复用的 CRC-16 和 `buildFrame()` 参考实现
- `firmware/include/protocol.h`：协议常量定义已稳定

**约束：**
- 串口操作必须在主进程（Node.js 原生模块不能在渲染进程/sandbox 中运行）
- `serialport` 是原生 C++ addon，需要 electron-rebuild 编译
- USB CDC 实际不受波特率限制，但 `Serial.begin(115200)` 是固件侧设置

## Goals / Non-Goals

**Goals:**
- Electron 主进程能扫描系统串口并自动识别 ESP32-S3（VID=0x303A）
- 提供可靠的连接/断开/自动重连能力
- 实现完整的二进制帧编码器，与固件 `BinaryProtocol.cpp` 完全互操作
- 192KB 帧缓冲区分块发送 + 逐块 ACK 确认 + NAK 重传
- PING/PONG 心跳检测连接活性
- 通过 IPC 将串口状态和操作暴露给渲染进程
- CRC-16、帧构建、响应解析有完整单元测试

**Non-Goals:**
- 不实现 WiFi/蓝牙等其他传输通道
- 不实现 UI 组件（SerialPanel.vue 留到 Phase 7）
- 不实现渲染管线（offscreen 截屏 → 量化 → 发送，留到 Phase 6）
- 不变更固件端任何代码
- 不实现 JSON/STX-ETX 文本帧兼容模式（本项目不需要旧协议兼容）

## Decisions

### D1: serialport 包版本与安装策略

**选择**: `serialport@12.x`（最新稳定版）+ `@electron/rebuild` 确保原生模块兼容

**理由**:
- serialport 12.x 支持 Node.js 20+，与 Electron 41 的 Node 版本匹配
- `electron.vite.config.ts` 已预先将 `serialport` 声明为 external，vite 不会尝试打包它
- electron-rebuild 在 postinstall 钩子中自动编译，无需手动操作

**否决**: Web Serial API — 需要用户手动授权设备，无法后台静默连接

### D2: 模块职责划分

**选择**: 三文件分层架构

```
electron/serial/
├── serial-manager.ts      # 连接生命周期管理（扫描、连接、断开、重连、事件）
├── binary-protocol.ts     # 帧编码 + 分块传输逻辑（纯逻辑，不直接持有串口引用）
└── response-parser.ts     # 从字节流中解析固件响应（状态机）
```

**理由**:
- `serial-manager` 持有 SerialPort 实例，管理连接生命周期，暴露高层 API（`sendFrameBuffer()`）
- `binary-protocol` 是纯函数模块：`buildFrame(cmd, payload)` → Buffer，`crc16Ccitt(data)` → number，不依赖 I/O，100% 可单元测试
- `response-parser` 是有状态的字节流解析器，从串口 `data` 事件的 Buffer 块中提取 PONG/ACK/NAK/DISPLAY_DONE 响应
- 职责清晰：协议编码/解码与连接管理解耦

**否决**: 单文件方案 — 可测试性差，职责耦合

### D3: 响应解析策略

**选择**: 基于状态机的流式解析器

**理由**:
- 串口 `data` 事件的 Buffer 可能跨帧分片（一个事件的 Buffer 可能包含半个响应或多个响应）
- ESP32 还会输出调试日志文本（如 `[INF] Transfer BEGIN...`），必须跳过
- 状态机从字节流中识别 `0xEB 0x0D` 魔数，根据后续字节判断响应类型和长度

**响应格式回顾**（均以 `0xEB 0x0D` 开头）:
| 类型 | 字节数 | 格式 |
|------|--------|------|
| PONG | 3 | `EB 0D 80` |
| ACK | 5 | `EB 0D 81 idx_lo idx_hi` |
| NAK | 5 | `EB 0D 82 idx_lo idx_hi` |
| DISPLAY_DONE | 3 | `EB 0D 83` |

### D4: 分块传输流程与错误处理

**选择**: 顺序发送 + 逐块等待 ACK + NAK 重传（最多 3 次）+ 整体超时

**流程**:
```
1. buildFrame(CMD_BEGIN, [total_size, chunk_size, total_chunks]) → 发送 → 等待 ACK(0)
2. for i = 0 to 46:
     buildFrame(CMD_DATA, [chunk_index, chunk_data]) → 发送 → 等待 ACK(i)
     如果 NAK(i): 重传（最多 3 次），3 次失败则中止
     如果超时 5s: 视为 NAK，重传
3. buildFrame(CMD_END, []) → 发送 → 等待 DISPLAY_DONE
```

**超时参数**:
- 单块 ACK 等待: 5000ms（对齐固件 FRAME_BYTE_TIMEOUT_MS）
- 整体传输超时: 60000ms（对齐固件 TRANSFER_TIMEOUT_MS）
- DISPLAY_DONE 等待: 30000ms（墨水屏刷新约 15-20 秒）

**进度回调**: `sendFrameBuffer()` 接受 `onProgress(chunkIndex, totalChunks)` 回调，用于 UI 进度条

### D5: 自动重连策略

**选择**: 指数退避重连，最大间隔 30 秒

**策略**:
- 检测到串口 `close` 或 `error` 事件
- 第 1 次重连延迟 1s，第 2 次 2s，第 3 次 4s ... 最大 30s
- 每次重连前先执行 `scan()` 确认设备仍在系统中
- 连接成功后发送 PING 验证通信正常
- 用户手动断开则不自动重连

### D6: IPC 通道设计

**通道列表（ipcMain.handle — request/response）**:
| 通道 | 参数 | 返回值 |
|------|------|--------|
| `serial:scan` | 无 | `PortInfo[]`（含 isEsp32 标记） |
| `serial:connect` | `{ path: string }` | `{ success, error? }` |
| `serial:disconnect` | 无 | `{ success }` |
| `serial:send-buffer` | `{ buffer: Uint8Array }` | `{ success, error?, duration? }` |
| `serial:ping` | 无 | `{ alive: boolean, latency?: number }` |
| `serial:status` | 无 | `{ connected, portPath?, deviceInfo? }` |

**通道列表（主进程 → 渲染进程推送）**:
| 通道 | 数据 |
|------|------|
| `serial:state-changed` | `{ connected, portPath?, error? }` |
| `serial:transfer-progress` | `{ chunkIndex, totalChunks, percent }` |
| `serial:log` | `{ level, message }` |

### D7: preload 增强

**当前问题**: `preload.ts` 的 `on()` 方法注册 listener 后无法移除，Vue 组件 unmount 时会内存泄漏。

**修改**: 新增 `off(channel, callback)` 方法，底层调用 `ipcRenderer.removeListener()`。

## Risks / Trade-offs

### R1: serialport 原生模块编译
- **风险**: Electron 版本升级后 serialport 可能编译失败
- **缓解**: 锁定 serialport 和 electron 版本；使用 `@electron/rebuild`

### R2: USB CDC 设备被其他程序占用
- **风险**: 串口监视器（PlatformIO Monitor）可能占用端口
- **缓解**: 连接失败时给出明确错误信息"端口已被占用"

### R3: 传输中设备拔出
- **风险**: 发送过程中 USB 断开，状态残留
- **缓解**: serialport 的 `close` 事件触发清理；设置整体传输超时；传输 Promise reject

### R4: 块间延迟对传输速度的影响
- **风险**: 逐块等待 ACK 可能导致传输较慢
- **缓解**: USB CDC 全速模式下 ACK 延迟很低（<10ms），47 块顺序传输预计 <3 秒（含 ESP32 处理时间）

### R5: Windows 上 COM 端口号不固定
- **风险**: 重新插拔设备后 COM 号可能变化
- **缓解**: 自动扫描通过 VID 匹配设备，不依赖固定 COM 号
