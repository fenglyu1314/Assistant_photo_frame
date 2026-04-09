## 1. 依赖安装与项目配置

- [x] 1.1 安装 `serialport` 依赖到 companion/package.json（dependencies），安装 `@serialport/bindings-cpp` 类型和 `@electron/rebuild` 到 devDependencies
- [x] 1.2 验证 `electron.vite.config.ts` 中 serialport 已在 external 列表（已有），确认构建不打包原生模块
- [x] 1.3 在 companion/package.json 中添加 `postinstall` 脚本调用 `electron-rebuild`，确保原生模块兼容 Electron 41

## 2. 协议常量与 CRC（binary-protocol.ts 纯逻辑层）

- [x] 2.1 创建 `companion/electron/serial/binary-protocol.ts`：导出协议常量（MAGIC, CMD_*, RESP_*, FRAME_BUFFER_SIZE, DEFAULT_CHUNK_SIZE），完全对齐 firmware/include/protocol.h
- [x] 2.2 实现 `crc16Ccitt(data: Buffer): number` 和 `crc16Update(crc: number, byte: number): number`，算法与 firmware/lib/SerialProtocol/crc16.cpp 一致（参考 tools/test_protocol.js）
- [x] 2.3 实现 `buildFrame(cmd: number, payload?: Buffer): Buffer`：构建完整帧 MAGIC+CMD+LENGTH(LE)+DATA+CRC(LE)
- [x] 2.4 实现便捷函数：`buildBeginFrame(totalSize, chunkSize, totalChunks)`、`buildDataFrame(chunkIndex, chunkData)`、`buildEndFrame()`、`buildPingFrame()`

## 3. 响应解析器（response-parser.ts）

- [x] 3.1 创建 `companion/electron/serial/response-parser.ts`：定义响应类型 `ResponseType = 'pong' | 'ack' | 'nak' | 'display-done'` 和 `ParsedResponse` 接口
- [x] 3.2 实现 `ResponseParser` 类：流式字节状态机，从串口数据块中识别 MAGIC(0xEB 0x0D) 头 → 读取响应类型 → 读取可选载荷（ACK/NAK 的 chunk_index） → 发出 `response` 事件
- [x] 3.3 处理调试日志文本：非 MAGIC 开头的字节序列直接跳过（不干扰响应解析）

## 4. 串口管理器（serial-manager.ts）

- [x] 4.1 创建 `companion/electron/serial/serial-manager.ts`：`SerialManager` 类（EventEmitter），内部持有 SerialPort 实例和 ResponseParser
- [x] 4.2 实现 `scan()` 方法：调用 `SerialPort.list()` 扫描所有端口，匹配 vendorId='303A' 标记 `isEsp32: true`
- [x] 4.3 实现 `connect(portPath: string)` 方法：打开串口（115200 baud）→ 绑定 data/close/error 事件 → 发送 PING 验证（3s 超时）→ 发出 `state-changed` 事件
- [x] 4.4 实现 `disconnect()` 方法：安全关闭串口、停止自动重连、发出 `state-changed` 事件
- [x] 4.5 实现自动重连逻辑：检测意外断开后启动指数退避重连（1s→2s→4s→...→30s），重连前先 scan 确认设备存在
- [x] 4.6 实现 `sendFrameBuffer(buffer: Uint8Array, onProgress?)` 方法：完整 BEGIN→DATA×47→END 分块传输流程，逐块等待 ACK/NAK，NAK 重试最多 3 次，支持进度回调
- [x] 4.7 实现 `ping()` 方法：发送 PING 帧，等待 PONG（3s 超时），返回 `{ alive, latencyMs? }`
- [x] 4.8 实现 `getStatus()` 方法：返回当前连接状态

## 5. IPC 桥接集成

- [x] 5.1 在 `companion/electron/main.ts` 中导入 SerialManager，在 `app.whenReady()` 中初始化单例实例
- [x] 5.2 注册 ipcMain.handle 处理器：`serial:scan`、`serial:connect`、`serial:disconnect`、`serial:send-buffer`、`serial:ping`、`serial:status`
- [x] 5.3 监听 SerialManager 事件，通过 `mainWindow.webContents.send()` 转发 `serial:state-changed` 和 `serial:transfer-progress` 到渲染进程
- [x] 5.4 更新 `companion/electron/preload.ts`：新增 `off(channel, callback)` 方法，底层调用 `ipcRenderer.removeListener()`
- [x] 5.5 更新 `companion/src/env.d.ts`：在 `window.api` 类型声明中新增 `off` 方法签名

## 6. 单元测试

- [x] 6.1 创建 `companion/electron/serial/__tests__/binary-protocol.test.ts`：测试 CRC 计算（空数据、已知数据、增量一致性）、帧构建（PING/BEGIN/DATA/END 格式正确性）、协议常量值
- [x] 6.2 创建 `companion/electron/serial/__tests__/response-parser.test.ts`：测试 PONG/ACK/NAK/DISPLAY_DONE 解析、跨 Buffer 分片解析、调试文本忽略、连续多响应解析
- [x] 6.3 更新 `companion/vitest.config.ts`：将测试 include 路径扩展为同时覆盖 `src/**/__tests__/**/*.test.ts` 和 `electron/**/__tests__/**/*.test.ts`
- [x] 6.4 运行全部测试确保通过（`npm run test`）

## 7. 构建验证

- [x] 7.1 执行 `npm run build` 确认 electron-vite 构建无 TypeScript 错误
- [x] 7.2 执行 `npm run dev` 确认应用正常启动，控制台无串口相关报错（设备未连接时优雅降级）
