## ADDED Requirements

### Requirement: 二进制帧格式定义
系统必须支持二进制帧传输协议，帧结构为：MAGIC(2B) + CMD(1B) + LENGTH(4B) + DATA(NB) + CRC(2B)。

- MAGIC 必须为 `0xEB 0x0D`（固定两字节魔数）
- CMD 为 1 字节命令类型
- LENGTH 为 uint32 小端序，表示 DATA 段的字节长度
- CRC 为 CRC-16/CCITT，覆盖 CMD + LENGTH + DATA
- 帧总大小不超过 4104 字节（帧头 7B + 数据 4096B + CRC 2B - 1B 冗余）

#### Scenario: 帧结构解析
- **WHEN** ESP32 串口收到以 `0xEB 0x0D` 开头的字节序列
- **THEN** 系统必须按二进制帧协议解析：读取 CMD(1B) + LENGTH(4B)，然后精确读取 LENGTH 字节的 DATA，最后读取 CRC(2B) 并校验

#### Scenario: CRC校验失败
- **WHEN** 计算得到的 CRC 与帧尾 CRC 不匹配
- **THEN** 系统必须丢弃该帧，回复 NAK 响应

#### Scenario: 非MAGIC开头数据
- **WHEN** 串口收到不以 `0xEB 0x0D` 开头的字节序列
- **THEN** 系统必须忽略该数据（视为调试日志文本）

### Requirement: CMD类型定义
二进制协议必须支持以下 CMD 类型：
- `0x01` = BEGIN（帧缓冲区传输开始）
- `0x02` = DATA（数据块）
- `0x03` = END（传输完成）
- `0xFF` = PING（心跳检测）

#### Scenario: 收到未知CMD
- **WHEN** ESP32 收到 CMD 值不属于 0x01/0x02/0x03/0xFF 的帧
- **THEN** 系统必须丢弃该帧，忽略处理

### Requirement: 分块传输机制
192KB 帧缓冲区必须通过分块传输方式发送。每块默认 4096 字节，最后一块可以不足 4096 字节。

传输流程：
1. PC 发送 BEGIN 帧 (CMD=0x01)，携带 total_size(uint32 LE), chunk_size(uint16 LE), total_chunks(uint16 LE)
2. PC 逐块发送 DATA 帧 (CMD=0x02)，携带 chunk_index(uint16 LE) + chunk_data
3. ESP32 每收到一块回复 ACK(chunk_index) 或 NAK(chunk_index)
4. PC 发送 END 帧 (CMD=0x03) 表示传输完成
5. ESP32 刷屏后回复 ACK

#### Scenario: 正常分块传输
- **WHEN** PC 开始传输 192,000 字节帧缓冲区，chunk_size=4096
- **THEN** 总共必须发送 47 个数据块（前 46 块各 4096 字节，最后一块 3072 字节），每块收到 ACK 后再发下一块

#### Scenario: 单块CRC校验失败
- **WHEN** ESP32 收到某数据块但 CRC 校验失败
- **THEN** ESP32 必须回复 NAK + chunk_index，请求重传

#### Scenario: 块序号越界
- **WHEN** 收到的 DATA 帧中 chunk_index >= total_chunks
- **THEN** ESP32 必须丢弃该块，回复 NAK + chunk_index

#### Scenario: 传输完成刷屏
- **WHEN** ESP32 收到 END 帧 (CMD=0x03) 且所有块已正确接收
- **THEN** 系统必须调用 `epd.display()` 刷新墨水屏，刷屏完成后回复 ACK

#### Scenario: 传输完成但数据不完整
- **WHEN** ESP32 收到 END 帧 (CMD=0x03) 但存在未接收的块
- **THEN** 系统必须回复 NAK，不触发刷屏

### Requirement: ESP32端流式写入PSRAM
ESP32 接收二进制帧数据块时，必须边收边写入 PSRAM 帧缓冲区对应偏移位置，不需要等待全部数据到齐。

#### Scenario: 边收边写
- **WHEN** ESP32 收到 chunk_index=5 的数据块（chunk_size=4096）
- **THEN** 必须将数据写入 PSRAM 缓冲区偏移 `5 × 4096 = 20480` 的位置，然后回复 ACK

#### Scenario: PSRAM缓冲区分配
- **WHEN** ESP32 固件启动
- **THEN** 必须在 PSRAM 中静态分配 192,000 字节的帧缓冲区

### Requirement: 心跳检测
系统必须支持 PING/PONG 心跳机制，用于 PC 端检测 ESP32 连接状态。

#### Scenario: 心跳响应
- **WHEN** PC 发送 CMD=0xFF 的 PING 帧
- **THEN** ESP32 必须立即回复 PONG 响应（`0xEB 0x0D 0x80`）

### Requirement: 响应帧格式
ESP32 的所有协议响应必须使用二进制格式，以 MAGIC 头开头。

响应类型：
- ACK: `0xEB 0x0D 0x81 chunk_index(2B LE)`
- NAK: `0xEB 0x0D 0x82 chunk_index(2B LE)`
- PONG: `0xEB 0x0D 0x80`
- 刷屏完成: `0xEB 0x0D 0x83`

#### Scenario: ACK响应格式
- **WHEN** ESP32 成功接收 chunk_index=10 的数据块
- **THEN** 必须发送 `0xEB 0x0D 0x81 0x0A 0x00`（5 字节）

#### Scenario: 刷屏完成响应
- **WHEN** EPD 刷屏操作完成
- **THEN** 必须发送 `0xEB 0x0D 0x83`（3 字节）

### Requirement: 超时处理
系统必须实现多级超时机制，防止协议状态机卡死。

#### Scenario: 帧内超时
- **WHEN** 协议状态机处于非 IDLE 状态，5 秒内未收到下一字节
- **THEN** 系统必须重置状态机到 IDLE 状态，丢弃未完成的帧

#### Scenario: 传输超时
- **WHEN** 收到 BEGIN 帧后 60 秒内未收到 END 帧
- **THEN** 系统必须丢弃已接收的所有块数据，重置状态机到 IDLE 状态

### Requirement: RX缓冲区配置
ESP32 必须在 `Serial.begin()` 之前将 RX 缓冲区扩大到至少 8192 字节，以支持 4KB 分块传输。

#### Scenario: 缓冲区扩大
- **WHEN** ESP32 固件启动执行 setup()
- **THEN** 必须在 `Serial.begin(115200)` 之前调用 `Serial.setRxBufferSize(8192)`

### Requirement: PC 端 CRC-16/CCITT 计算
PC 端（companion 应用）必须实现 CRC-16/CCITT 算法（poly=0x1021, init=0x0000），与固件端 `crc16.cpp` 的实现完全一致。

#### Scenario: 空数据 CRC
- **WHEN** 对空字节数组计算 CRC
- **THEN** 必须返回 0x0000

#### Scenario: CRC 与固件一致
- **WHEN** 对 `[0xFF, 0x00, 0x00, 0x00, 0x00]`（PING 帧的 CMD+LENGTH）计算 CRC
- **THEN** 结果必须与固件 `crc16_ccitt()` 对相同数据的计算结果完全一致

#### Scenario: 增量 CRC 计算
- **WHEN** 对数据逐字节调用 `crc16Update(crc, byte)` 与对整块数据调用 `crc16Ccitt(data)`
- **THEN** 两种方式的结果必须完全相同

### Requirement: PC 端二进制帧构建
PC 端必须能构建符合 `protocol.h` 定义的完整二进制帧：MAGIC(2B) + CMD(1B) + LENGTH(4B LE) + DATA(NB) + CRC(2B LE)。CRC 覆盖 CMD + LENGTH + DATA。

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

### Requirement: PC 端分块传输流程
PC 端必须实现完整的 192KB 帧缓冲区分块传输流程：BEGIN → DATA×N → END，每块等待 ACK 确认。

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

### Requirement: PC 端 PING/PONG 心跳
PC 端必须支持发送 PING 帧并等待 PONG 响应，用于检测设备连接活性。

#### Scenario: PING 成功
- **WHEN** 调用 `ping()` 且设备正常响应
- **THEN** 必须发送 PING 帧，收到 PONG 后返回 `{ alive: true, latencyMs: <毫秒数> }`

#### Scenario: PING 超时
- **WHEN** 调用 `ping()` 且设备 3000ms 内未响应
- **THEN** 必须返回 `{ alive: false }`

### Requirement: PC 端协议常量定义
PC 端模块必须导出与固件 `protocol.h` 完全对齐的协议常量。

#### Scenario: 常量值一致
- **WHEN** 检查模块导出的协议常量
- **THEN** 必须与固件定义完全一致：MAGIC=[0xEB, 0x0D], CMD_BEGIN=0x01, CMD_DATA=0x02, CMD_END=0x03, CMD_PING=0xFF, RESP_PONG=0x80, RESP_ACK=0x81, RESP_NAK=0x82, RESP_DISPLAY_DONE=0x83, FRAME_BUFFER_SIZE=192000, DEFAULT_CHUNK_SIZE=4096
