## Context

ESP32 固件 Phase 1 已完成：EPaperDriver 移植、清屏验证通过。当前 `main.cpp` 只有初始化逻辑，无串口数据接收能力。

本设计为固件添加二进制帧协议处理，使 ESP32 能从 桌面端接收 192KB 帧缓冲区数据并驱动墨水屏刷新。这是渲染管线的基础——没有通信能力，后续所有 Phase（Electron 串口通信、渲染管线）都无法推进。

**约束**：
- ESP32-S3 USB CDC 串口 115200 baud，传输 192KB 约 17-20 秒
- PSRAM 8MB 充足，帧缓冲区 192,000 字节（800/2 × 480, 4-bit packed）
- RX 缓冲区需扩大到 8KB 以匹配 4KB 分块
- 不兼容旧 STX/ETX 文本协议（已确认去除）

**参考**：旧项目 `Reference/ESP32-S3-PhotoPainter/` 中的 `lib/SerialProtocol/BinaryProtocol.h` 提供协议状态机的实现思路，但需要重新设计（旧版依赖 STX/ETX 共存逻辑）。

## Goals / Non-Goals

**Goals:**
- ESP32 能正确解析二进制帧协议（MAGIC + CMD + LENGTH + DATA + CRC）
- 支持 BEGIN→DATA×47→END 分块传输，逐块 ACK/NAK 确认
- 接收数据流式写入 PSRAM 帧缓冲区对应偏移位置
- 传输完成后触发 EPD 刷屏
- PING/PONG 心跳用于连接状态检测
- 接收状态机健壮：CRC 校验失败丢弃、超时重置、乱序检测

**Non-Goals:**
- 不实现旧 STX/ETX 文本协议兼容
- 不实现协议自动识别（只有二进制协议）
- 不实现 JSON 兼容模式（CMD=0x10），仅保留帧缓冲区传输和心跳
- 不优化波特率（后续优化项）
- 不实现多设备同时连接

## Decisions

### D1: 协议状态机设计

**选择**：基于状态的接收状态机（IDLE → WAIT_CMD → WAIT_LEN → WAIT_DATA → WAIT_CRC）

**理由**：
- 串口数据流式到达，必须逐字节解析
- 定长头（MAGIC 2B + CMD 1B + LENGTH 4B）+ 变长 DATA + 定长 CRC 2B 的结构天然适合状态机
- 每个状态只关心当前需要的数据，代码清晰且不易出错

**否决方案**：
- 缓冲整个帧再解析：192KB 帧太大，不实际
- 回调式解析：在 Arduino loop() 中轮询更简单直接

### D2: 分块传输确认机制

**选择**：逐块 ACK/NAK，桌面端等 ACK 后再发下一块

**理由**：
- ESP32 RX 缓冲区 8KB，4KB 分块留有余量
- 逐块确认保证数据完整性，支持单块重传
- 实现简单，桌面端逻辑清晰

**ESP32 响应格式**：
```
ACK:  0xEB 0x0D 0x81 chunk_index(2B LE)    (4字节)
NAK:  0xEB 0x0D 0x82 chunk_index(2B LE)    (4字节)
PONG: 0xEB 0x0D 0x80                       (3字节)
```
使用 MAGIC 前缀的简单二进制响应，便于 桌面端解析。

### D3: PSRAM 帧缓冲区管理

**选择**：静态分配 192,000 字节 PSRAM 缓冲区 + 位图追踪已接收块

**理由**：
- PSRAM 充足（8MB），静态分配最简单
- `received_chunks` 位图（47 bit，6 字节）追踪每块接收状态
- 收到 BEGIN 帧时清零位图，收到 DATA 帧时写入对应偏移并标记
- 收到 END 帧时检查所有块是否已接收，完整则刷屏

**否决方案**：
- 动态分配：增加碎片化风险，无必要
- 双缓冲：8MB PSRAM 够用但当前无并发需求

### D4: 超时与错误处理

**选择**：多级超时 + 状态重置

- **帧内超时**：收不到下一字节超过 5 秒 → 重置状态机到 IDLE
- **传输超时**：BEGIN 后 60 秒未收到 END → 丢弃已收数据，重置状态机
- **CRC 校验失败**：丢弃当前帧，回复 NAK
- **块序号越界**：丢弃该块，回复 NAK

### D5: 调试日志策略

**选择**：通过 `Serial.printf()` 输出调试日志，与协议帧共用串口

**约定**：
- 调试日志以 `[DBG]`、`[INF]`、`[ERR]` 前缀
- 协议帧以 MAGIC `0xEB 0x0D` 开头
- 桌面端通过 MAGIC 头区分协议帧和调试文本（MAGIC 的 `0xEB` 极少出现在普通文本中）

## Risks / Trade-offs

### R1: USB CDC 实际吞吐量
- **风险**：115200 baud 理论 ~11.5 KB/s，192KB 需 ~17 秒，实际可能更慢
- **缓解**：当前可接受，后续作为优化项探索更高波特率或 USB CDC 高速模式

### R2: 串口数据丢失
- **风险**：ESP32 loop() 中处理其他任务时可能错过串口数据
- **缓解**：loop() 中优先处理串口；扩大 RX 缓冲区到 8KB；逐块 ACK 确保可重传

### R3: PSRAM 写入速度
- **风险**：PSRAM OPI 模式写入延迟可能影响块接收间隔
- **缓解**：4KB 块写入 PSRAM 在 ESP32-S3 240MHz 下极快（<1ms），不构成瓶颈

### R4: 调试日志干扰协议解析
- **风险**：ESP32 输出的调试日志文本可能包含 `0xEB 0x0D` 字节序列
- **缓解**：调试日志使用 ASCII 文本，MAGIC 序列在 ASCII 中极罕见；桌面端严格按 MAGIC + 帧结构解析，非 MAGIC 开头的数据忽略
