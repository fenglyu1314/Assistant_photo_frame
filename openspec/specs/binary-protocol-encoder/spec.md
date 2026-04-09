## ADDED Requirements

### Requirement: CRC-16/CCITT 计算
模块必须实现 CRC-16/CCITT 算法（poly=0x1021, init=0x0000），与固件端 `crc16.cpp` 的实现完全一致。

#### Scenario: 空数据 CRC
- **WHEN** 对空字节数组计算 CRC
- **THEN** 必须返回 0x0000

#### Scenario: CRC 与固件一致
- **WHEN** 对 `[0xFF, 0x00, 0x00, 0x00, 0x00]`（PING 帧的 CMD+LENGTH）计算 CRC
- **THEN** 结果必须与固件 `crc16_ccitt()` 对相同数据的计算结果完全一致

#### Scenario: 增量 CRC 计算
- **WHEN** 对数据逐字节调用 `crc16Update(crc, byte)` 与对整块数据调用 `crc16Ccitt(data)` 
- **THEN** 两种方式的结果必须完全相同

### Requirement: 二进制帧构建
模块必须能构建符合 `protocol.h` 定义的完整二进制帧：MAGIC(2B) + CMD(1B) + LENGTH(4B LE) + DATA(NB) + CRC(2B LE)。CRC 覆盖 CMD + LENGTH + DATA。

#### Scenario: 构建 PING 帧
- **WHEN** 调用 `buildFrame(CMD_PING)` 无载荷
- **THEN** 必须返回 Buffer: `[0xEB, 0x0D, 0xFF, 0x00, 0x00, 0x00, 0x00, crc_lo, crc_hi]`，共 9 字节

#### Scenario: 构建 BEGIN 帧
- **WHEN** 调用 `buildBeginFrame(192000, 4096, 47)`
- **THEN** 必须返回 Buffer: MAGIC + CMD_BEGIN(0x01) + LENGTH(8, LE) + [total_size(4B LE), chunk_size(2B LE), total_chunks(2B LE)] + CRC(2B LE)

#### Scenario: 构建 DATA 帧
- **WHEN** 调用 `buildDataFrame(chunkIndex, chunkData)` 其中 chunkData 为 4096 字节
- **THEN** 必须返回 Buffer: MAGIC + CMD_DATA(0x02) + LENGTH(4098, LE) + [chunk_index(2B LE), chunkData(4096B)] + CRC(2B LE)

#### Scenario: 构建 END 帧
- **WHEN** 调用 `buildEndFrame()`
- **THEN** 必须返回 Buffer: MAGIC + CMD_END(0x03) + LENGTH(0, LE) + CRC(2B LE)，共 9 字节

### Requirement: 分块传输流程
模块必须实现完整的 192KB 帧缓冲区分块传输流程：BEGIN → DATA×N → END，每块等待 ACK 确认。

#### Scenario: 正常传输 192KB
- **WHEN** 调用 `sendFrameBuffer(buffer)` 传入 192,000 字节的 Uint8Array
- **THEN** 必须依次发送 BEGIN 帧（等待 ACK）、47 个 DATA 帧（每个等待 ACK）、END 帧（等待 DISPLAY_DONE），总共发送 49 个帧

#### Scenario: 分块大小计算
- **WHEN** 传输 192,000 字节帧缓冲区，chunk_size=4096
- **THEN** 前 46 块各 4096 字节，最后一块（index=46）为 3072 字节（192000 - 46×4096 = 3072）

#### Scenario: NAK 重传
- **WHEN** 发送第 N 块后收到 NAK(N)
- **THEN** 必须重新发送第 N 块，最多重试 3 次；3 次均 NAK 后必须中止传输并返回错误

#### Scenario: ACK 等待超时
- **WHEN** 发送第 N 块后 5000ms 内未收到 ACK 或 NAK
- **THEN** 必须视为传输失败，重新发送第 N 块（计入重试次数）

#### Scenario: 整体传输超时
- **WHEN** 从 BEGIN 发送起算超过 60000ms 传输仍未完成
- **THEN** 必须中止传输并返回超时错误

#### Scenario: 传输进度回调
- **WHEN** 每成功发送一块并收到 ACK
- **THEN** 必须调用进度回调函数，提供 `{ chunkIndex, totalChunks, percent }`

#### Scenario: DISPLAY_DONE 等待
- **WHEN** 发送 END 帧后
- **THEN** 必须等待 DISPLAY_DONE 响应，超时 30000ms（墨水屏刷新需要约 15-20 秒）

### Requirement: PING/PONG 心跳
模块必须支持发送 PING 帧并等待 PONG 响应，用于检测设备连接活性。

#### Scenario: PING 成功
- **WHEN** 调用 `ping()` 且设备正常响应
- **THEN** 必须发送 PING 帧，收到 PONG 后返回 `{ alive: true, latencyMs: <毫秒数> }`

#### Scenario: PING 超时
- **WHEN** 调用 `ping()` 且设备 3000ms 内未响应
- **THEN** 必须返回 `{ alive: false }`

### Requirement: 协议常量定义
模块必须导出与固件 `protocol.h` 完全对齐的协议常量。

#### Scenario: 常量值一致
- **WHEN** 检查模块导出的协议常量
- **THEN** 必须与固件定义完全一致：MAGIC=[0xEB, 0x0D], CMD_BEGIN=0x01, CMD_DATA=0x02, CMD_END=0x03, CMD_PING=0xFF, RESP_PONG=0x80, RESP_ACK=0x81, RESP_NAK=0x82, RESP_DISPLAY_DONE=0x83, FRAME_BUFFER_SIZE=192000, DEFAULT_CHUNK_SIZE=4096
