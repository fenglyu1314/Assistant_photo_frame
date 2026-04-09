## ADDED Requirements

### Requirement: 串口自动扫描
serial-manager 模块必须能扫描系统中所有可用串口，自动识别 ESP32-S3 设备。识别方式为检测 USB VID=0x303A（Espressif）。扫描结果必须包含端口路径、VID/PID、设备描述，以及是否为 ESP32 的标记。

#### Scenario: 发现 ESP32 设备
- **WHEN** 系统中连接了 VID=0x303A 的 USB CDC 设备，调用 `scan()` 方法
- **THEN** 返回的端口列表中必须包含该设备，且 `isEsp32` 标记为 `true`

#### Scenario: 无设备连接
- **WHEN** 系统中没有 VID=0x303A 的设备
- **THEN** `scan()` 必须返回完整的端口列表，所有端口的 `isEsp32` 为 `false`

#### Scenario: 多串口共存
- **WHEN** 系统中同时连接多个串口设备（含 ESP32 和其他设备）
- **THEN** 必须返回所有端口，仅 VID 匹配的端口标记为 `isEsp32: true`

### Requirement: 串口连接管理
模块必须提供连接（connect）、断开（disconnect）功能。连接时必须使用 115200 波特率打开指定串口。

#### Scenario: 连接成功
- **WHEN** 调用 `connect(portPath)` 且端口可用
- **THEN** 必须以 115200 波特率打开串口，发送 PING 帧验证通信正常，收到 PONG 后标记连接状态为 `connected`，并发出 `state-changed` 事件

#### Scenario: 连接失败 — 端口被占用
- **WHEN** 调用 `connect(portPath)` 但端口已被其他程序（如串口监视器）占用
- **THEN** 必须捕获异常，标记连接状态为 `disconnected`，返回包含错误原因的结果

#### Scenario: 连接失败 — 设备无响应
- **WHEN** 调用 `connect(portPath)` 成功打开端口但 PING 后 3 秒内未收到 PONG
- **THEN** 必须关闭端口，返回 `{ success: false, error: 'Device not responding' }`

#### Scenario: 断开连接
- **WHEN** 调用 `disconnect()`
- **THEN** 必须安全关闭串口句柄，释放端口，标记连接状态为 `disconnected`，发出 `state-changed` 事件

#### Scenario: 设备意外拔出
- **WHEN** 已连接的 USB 设备被物理拔出
- **THEN** 必须检测到串口 `close` 事件，标记连接状态为 `disconnected`，发出 `state-changed` 事件

### Requirement: 自动重连
当连接因设备拔出或错误意外断开时，模块必须自动尝试重连。用户主动断开时不触发自动重连。

#### Scenario: 设备拔出后重连
- **WHEN** 设备意外断开且自动重连已启用
- **THEN** 必须以指数退避策略（1s, 2s, 4s, 8s, 16s, 30s）定期扫描并尝试重连，连接成功后发出 `state-changed` 事件

#### Scenario: 用户主动断开不重连
- **WHEN** 用户调用 `disconnect()` 主动断开
- **THEN** 必须停止自动重连，不再尝试重新连接

#### Scenario: 重连次数上限
- **WHEN** 自动重连连续尝试超过 30 秒未成功
- **THEN** 必须持续以 30 秒间隔重试（无上限），直到设备恢复或用户手动操作

### Requirement: 设备状态事件
模块必须通过事件机制（EventEmitter 模式）广播连接状态变化，供 IPC 层转发给渲染进程。

#### Scenario: 状态变化事件
- **WHEN** 连接状态从 `disconnected` 变为 `connected`，或从 `connected` 变为 `disconnected`
- **THEN** 必须发出 `state-changed` 事件，携带 `{ connected: boolean, portPath?: string, error?: string }`

#### Scenario: 获取当前状态
- **WHEN** 调用 `getStatus()` 方法
- **THEN** 必须返回当前连接状态，包含 `connected`、`portPath`、`deviceInfo`（VID/PID）
