## ADDED Requirements

### Requirement: 独立预览渲染
RenderPipeline SHALL provide a `renderPreview()` method that executes Stage 1-5（数据收集 → 离屏渲染 → 饱和度增强 → 量化 → 编码）并返回预览图和缓存帧缓冲区，不触发设备同步。

#### Scenario: 执行预览渲染
- **WHEN** 调用 `renderPreview()`
- **THEN** 必须按顺序执行 Stage 1-5，返回 `{ success: true, previewDataUrl, durationMs }`，并将编码后的帧缓冲区缓存在实例内

#### Scenario: 预览渲染无需设备连接
- **WHEN** 串口设备未连接时调用 `renderPreview()`
- **THEN** 必须正常完成 Stage 1-5 并返回预览图，不报错

#### Scenario: 预览渲染阶段事件
- **WHEN** `renderPreview()` 执行过程中
- **THEN** 必须通过 `stage-progress` 事件报告 collecting → rendering → enhancing → quantizing → encoding → done 各阶段

### Requirement: 独立设备同步
RenderPipeline SHALL provide a `syncToDevice()` method that将已缓存的帧缓冲区发送到墨水屏（仅 Stage 6），不重新渲染。

#### Scenario: 同步已缓存的帧缓冲区
- **WHEN** 调用 `syncToDevice()` 且存在已缓存的帧缓冲区
- **THEN** 必须将缓存的帧缓冲区通过 `SerialManager.sendFrameBuffer()` 发送到墨水屏，返回 `{ success: true, durationMs }`

#### Scenario: 无缓存时同步
- **WHEN** 调用 `syncToDevice()` 但没有已缓存的帧缓冲区（尚未执行 renderPreview）
- **THEN** 必须返回 `{ success: false, error: 'No cached buffer' }`

#### Scenario: 设备未连接时同步
- **WHEN** 调用 `syncToDevice()` 但串口设备未连接
- **THEN** 必须返回 `{ success: false, error }` 并包含串口管理器返回的错误信息

#### Scenario: 同步阶段事件
- **WHEN** `syncToDevice()` 执行过程中
- **THEN** 必须通过 `stage-progress` 事件报告 sending 阶段，并通过 `transfer-progress` 事件报告传输进度

### Requirement: 帧缓冲区缓存管理
RenderPipeline SHALL cache the encoded frame buffer and preview data URL after `renderPreview()` completes successfully.

#### Scenario: 渲染后缓存帧缓冲区
- **WHEN** `renderPreview()` 成功完成
- **THEN** 必须将 192KB 物理帧缓冲区和 PNG previewDataUrl 缓存在实例内，供后续 `syncToDevice()` 使用

#### Scenario: 重新渲染覆盖缓存
- **WHEN** 再次调用 `renderPreview()`
- **THEN** 必须用新的渲染结果覆盖旧缓存

#### Scenario: 查询缓存状态
- **WHEN** 调用 `getStatus()`
- **THEN** 返回值必须包含 `hasCache: boolean` 字段，指示是否存在已缓存的帧缓冲区
