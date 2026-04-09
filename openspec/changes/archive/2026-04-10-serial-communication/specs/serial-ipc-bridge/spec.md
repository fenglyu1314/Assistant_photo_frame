## ADDED Requirements

### Requirement: 串口操作 IPC 通道
主进程必须注册 ipcMain.handle 处理器，将串口操作暴露给渲染进程。所有串口操作必须在主进程执行，渲染进程通过 `window.api.invoke()` 调用。

#### Scenario: serial:scan 通道
- **WHEN** 渲染进程调用 `window.api.invoke('serial:scan')`
- **THEN** 主进程必须执行串口扫描，返回 `PortInfo[]` 数组，每项包含 `{ path, vendorId, productId, manufacturer, isEsp32 }`

#### Scenario: serial:connect 通道
- **WHEN** 渲染进程调用 `window.api.invoke('serial:connect', { path: 'COM5' })`
- **THEN** 主进程必须尝试连接指定串口，返回 `{ success: boolean, error?: string }`

#### Scenario: serial:disconnect 通道
- **WHEN** 渲染进程调用 `window.api.invoke('serial:disconnect')`
- **THEN** 主进程必须断开当前串口连接，返回 `{ success: boolean }`

#### Scenario: serial:send-buffer 通道
- **WHEN** 渲染进程调用 `window.api.invoke('serial:send-buffer', { buffer })` 传入 192KB Uint8Array
- **THEN** 主进程必须通过二进制协议分块发送帧缓冲区，返回 `{ success: boolean, error?: string, durationMs?: number }`

#### Scenario: serial:ping 通道
- **WHEN** 渲染进程调用 `window.api.invoke('serial:ping')`
- **THEN** 主进程必须发送 PING 并等待 PONG，返回 `{ alive: boolean, latencyMs?: number }`

#### Scenario: serial:status 通道
- **WHEN** 渲染进程调用 `window.api.invoke('serial:status')`
- **THEN** 主进程必须返回当前串口状态 `{ connected: boolean, portPath?: string, deviceInfo?: object }`

### Requirement: 状态推送事件通道
主进程必须通过 `mainWindow.webContents.send()` 主动推送串口状态变化和传输进度到渲染进程。

#### Scenario: 连接状态变化推送
- **WHEN** 串口连接状态发生变化（连接成功、意外断开、重连成功）
- **THEN** 主进程必须向渲染进程发送 `serial:state-changed` 事件，携带 `{ connected, portPath?, error? }`

#### Scenario: 传输进度推送
- **WHEN** 帧缓冲区发送过程中每完成一块
- **THEN** 主进程必须向渲染进程发送 `serial:transfer-progress` 事件，携带 `{ chunkIndex, totalChunks, percent }`

### Requirement: IPC 通道安全
所有 IPC 通道必须在 preload 中通过 `contextBridge` 暴露，渲染进程不能直接访问 `ipcRenderer` 或 Node.js API。

#### Scenario: 通道白名单
- **WHEN** 渲染进程尝试调用 IPC 通道
- **THEN** 只有 preload 中声明的通道才可访问，直接操作 `ipcRenderer` 被 contextIsolation 隔离

#### Scenario: 参数验证
- **WHEN** 渲染进程传入非法参数（如 `serial:connect` 不传 path）
- **THEN** 主进程 handler 必须验证参数并返回错误，不崩溃
