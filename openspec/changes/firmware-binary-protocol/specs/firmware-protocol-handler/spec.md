## ADDED Requirements

### Requirement: 协议状态机
ESP32 必须实现基于状态的二进制帧接收状态机，状态转换：IDLE → WAIT_CMD → WAIT_LEN → WAIT_DATA → WAIT_CRC → (处理完成) → IDLE。

状态机必须在 loop() 中被持续调用，每次处理可用的串口数据。

#### Scenario: IDLE状态收到MAGIC首字节
- **WHEN** 状态机处于 IDLE 状态，串口收到 `0xEB`
- **THEN** 状态机必须转移到 MAGIC_PARTIAL 状态，等待第二个 MAGIC 字节

#### Scenario: MAGIC_PARTIAL状态收到0x0D
- **WHEN** 状态机处于 MAGIC_PARTIAL 状态，串口收到 `0x0D`
- **THEN** 状态机必须转移到 WAIT_CMD 状态

#### Scenario: MAGIC_PARTIAL状态收到非0x0D
- **WHEN** 状态机处于 MAGIC_PARTIAL 状态，串口收到非 `0x0D` 字节
- **THEN** 状态机必须重置到 IDLE 状态

#### Scenario: WAIT_CMD状态收到有效CMD
- **WHEN** 状态机处于 WAIT_CMD 状态，串口收到有效 CMD 值 (0x01/0x02/0x03/0xFF)
- **THEN** 状态机必须记录 CMD 值，转移到 WAIT_LEN 状态，重置长度计数器

#### Scenario: WAIT_LEN状态接收4字节长度
- **WHEN** 状态机处于 WAIT_LEN 状态，依次收到 4 字节
- **THEN** 状态机必须将 4 字节组装为 uint32 小端序 LENGTH 值，转移到 WAIT_DATA 状态

#### Scenario: LENGTH值超限
- **WHEN** WAIT_LEN 状态解析出 LENGTH > 4096
- **THEN** 状态机必须重置到 IDLE 状态，通过串口输出错误日志

#### Scenario: WAIT_DATA状态接收数据
- **WHEN** 状态机处于 WAIT_DATA 状态，接收完 LENGTH 字节数据
- **THEN** 状态机必须转移到 WAIT_CRC 状态

#### Scenario: WAIT_CRC状态接收2字节CRC
- **WHEN** 状态机处于 WAIT_CRC 状态，接收完 2 字节 CRC
- **THEN** 状态机必须计算 CMD+LENGTH+DATA 的 CRC-16/CCITT，与接收的 CRC 比较；若匹配则处理帧内容，若不匹配则回复 NAK 并重置到 IDLE

### Requirement: 协议处理集成到main.cpp
协议状态机必须集成到 `main.cpp` 的 `loop()` 函数中，在每次 loop 迭代中处理可用的串口数据。

#### Scenario: loop中持续处理串口
- **WHEN** `loop()` 被调用
- **THEN** 必须调用协议状态机的 `process()` 方法，处理所有可用的串口字节

#### Scenario: 传输完成后触发刷屏
- **WHEN** 协议状态机完成一次完整的分块传输（收到 END 且所有块完整）
- **THEN** 必须调用 EPD 的 `display()` 方法刷新墨水屏，刷屏完成后发送完成响应

#### Scenario: PING处理
- **WHEN** 协议状态机收到 PING 帧 (CMD=0xFF)
- **THEN** 必须立即回复 PONG，不影响当前传输状态

### Requirement: 传输状态管理
ESP32 必须维护当前分块传输的状态，包括：是否正在传输、总块数、块大小、已接收块位图。

#### Scenario: 收到BEGIN帧初始化传输状态
- **WHEN** 收到 BEGIN 帧 (CMD=0x01)
- **THEN** 必须解析 total_size, chunk_size, total_chunks，清零已接收块位图，设置传输状态为"传输中"

#### Scenario: 收到DATA帧更新位图
- **WHEN** 收到 DATA 帧 (CMD=0x02) 且 CRC 校验通过
- **THEN** 必须将 chunk_index 对应的位图位置标记为已接收，将数据写入 PSRAM 对应偏移

#### Scenario: 重复块处理
- **WHEN** 收到 chunk_index 对应的位图位已经标记为已接收
- **THEN** 必须仍然回复 ACK，但不重复写入 PSRAM
