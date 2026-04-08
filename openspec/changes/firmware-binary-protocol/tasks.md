## 1. 协议基础定义

- [x] 1.1 创建 `firmware/include/protocol.h`：定义 MAGIC、CMD 枚举、帧结构常量、响应帧格式
- [x] 1.2 创建 `firmware/lib/SerialProtocol/crc16.h` + `crc16.cpp`：实现 CRC-16/CCITT 计算函数，覆盖 CMD+LENGTH+DATA

## 2. 二进制帧接收状态机

- [x] 2.1 创建 `firmware/lib/SerialProtocol/BinaryProtocol.h`：定义 ProtocolState 枚举、BinaryProtocol 类接口（process/重置/状态查询）
- [x] 2.2 实现 `BinaryProtocol.cpp` 状态机核心：IDLE → MAGIC_PARTIAL → WAIT_CMD → WAIT_LEN → WAIT_DATA → WAIT_CRC 状态转换
- [x] 2.3 实现帧内超时（5秒无数据→重置）和传输超时（60秒未收到END→重置）

## 3. 分块传输与PSRAM写入

- [x] 3.1 在 BinaryProtocol 中实现 PSRAM 帧缓冲区静态分配（192,000 字节）+ 已接收块位图
- [x] 3.2 实现 BEGIN 帧处理：解析 total_size/chunk_size/total_chunks，初始化传输状态
- [x] 3.3 实现 DATA 帧处理：校验 chunk_index、流式写入 PSRAM 偏移位置、更新位图、回复 ACK/NAK
- [x] 3.4 实现 END 帧处理：检查所有块完整性，完整则触发刷屏+回复完成响应，不完整则回复 NAK
- [x] 3.5 实现重复块处理：位图已标记的块仍回复 ACK 但不重复写入

## 4. 心跳与响应

- [x] 4.1 实现 PING 帧处理：收到 CMD=0xFF 立即回复 PONG（0xEB 0x0D 0x80）
- [x] 4.2 实现响应帧发送函数：sendAck(chunk_index)、sendNak(chunk_index)、sendPong()、sendDisplayDone()

## 5. 集成到 main.cpp

- [x] 5.1 修改 `firmware/src/main.cpp`：在 setup() 中扩大 RX 缓冲区 (setRxBufferSize(8192))，初始化 BinaryProtocol
- [x] 5.2 修改 `firmware/src/main.cpp`：在 loop() 中调用 protocol.process()，处理串口数据
- [x] 5.3 编译验证（用户手动执行 `pio run`）
- [x] 5.4 烧录 + 串口模拟测试（用户手动执行：烧录后用 Node.js 脚本发送 PING/二进制帧验证）
