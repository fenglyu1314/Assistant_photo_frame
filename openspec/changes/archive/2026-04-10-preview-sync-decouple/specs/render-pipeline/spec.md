## MODIFIED Requirements

### Requirement: 完整渲染管线执行
RenderPipeline 必须编排从数据收集到墨水屏刷屏的完整流程。`execute()` 方法 SHALL 内部调用 `renderPreview()` + `syncToDevice()` 作为快捷方式。

#### Scenario: 一键执行完整管线
- **WHEN** 调用 `RenderPipeline.execute()`
- **THEN** 必须依次调用 `renderPreview()` 和 `syncToDevice()`，返回 `{ success, error?, durationMs?, previewDataUrl? }`

#### Scenario: 无设备连接时执行
- **WHEN** 执行管线但串口未连接
- **THEN** `renderPreview()` 阶段必须正常完成并缓存结果，`syncToDevice()` 阶段返回错误 `{ success: false, error }`，但 previewDataUrl 仍然包含在返回结果中

#### Scenario: 管线执行中报告阶段
- **WHEN** 管线每完成一个阶段
- **THEN** 必须通过回调或事件报告当前阶段名称（如 'rendering', 'quantizing', 'sending'），供 UI 显示进度

### Requirement: 管线错误处理
管线在任何阶段失败时必须正确清理资源并报告错误。

#### Scenario: 渲染阶段失败
- **WHEN** 离屏渲染超时或失败
- **THEN** 管线必须清理离屏窗口资源，返回 `{ success: false, error: '渲染失败: <详情>' }`

#### Scenario: 量化阶段异常
- **WHEN** 量化或编码过程抛出异常
- **THEN** 管线必须捕获异常，返回 `{ success: false, error: '量化失败: <详情>' }`

#### Scenario: 并发执行保护
- **WHEN** 前一次管线执行尚未完成时再次触发（无论是 renderPreview、syncToDevice 还是 execute）
- **THEN** 必须拒绝并发执行，返回 `{ success: false, error: 'Pipeline already running' }`

### Requirement: 渲染管线组件集成
管线必须正确组合离屏渲染、量化引擎、帧编码器和串口管理器。

#### Scenario: RGBA 到物理缓冲区转换
- **WHEN** 离屏渲染输出 480×800 RGBA 像素数据
- **THEN** 管线必须调用 `enhanceSaturation()` → `quantizeFloydSteinberg()` → `encodeToPhysicalBuffer()` 生成 192,000 字节的物理缓冲区

#### Scenario: 缓冲区发送
- **WHEN** 调用 `syncToDevice()` 且存在已缓存的物理缓冲区
- **THEN** 管线必须调用 `SerialManager.sendFrameBuffer()` 发送帧缓冲区，传输进度由 SerialManager 负责
