## Requirements

### Requirement: 独立预览渲染
RenderPipeline SHALL provide a `renderPreview()` method that executes Stage 1-5（数据收集 → 离屏渲染 → 饱和度增强 → 量化 → 编码）并返回预览图、量化效果图和缓存帧缓冲区，不触发设备同步。

函数签名：
```typescript
renderPreview(params?: QuantizationParams): Promise<PreviewResult>
```

#### Scenario: 执行预览渲染
- **WHEN** 调用 `renderPreview()`
- **THEN** 必须按顺序执行 Stage 1-5，返回 `{ success: true, previewDataUrl, quantizedDataUrl, colorStats, durationMs }`，并将编码后的帧缓冲区缓存在实例内

#### Scenario: 量化效果图生成
- **WHEN** Stage 4 量化完成产出 indices 数组后
- **THEN** 管线 SHALL 调用 `indicesToDataUrl(indices, width, height)` 生成量化效果图 PNG data URL，并将结果包含在返回值的 `quantizedDataUrl` 字段中

#### Scenario: 色彩统计信息返回
- **WHEN** `renderPreview()` 成功完成
- **THEN** 返回值 SHALL 包含 `colorStats` 字段，记录 6 色各自的像素数量和百分比

#### Scenario: 预览渲染无需设备连接
- **WHEN** 串口设备未连接时调用 `renderPreview()`
- **THEN** 必须正常完成 Stage 1-5 并返回预览图和量化效果图，不报错

#### Scenario: 预览渲染阶段事件
- **WHEN** `renderPreview()` 执行过程中
- **THEN** 必须通过 `stage-progress` 事件报告 collecting → rendering → enhancing → preprocessing → quantizing → encoding → done 各阶段

#### Scenario: 不传参数时行为不变
- **WHEN** 调用 `renderPreview()` 不传参数
- **THEN** 行为与修改前完全一致，使用所有默认量化参数

#### Scenario: 传入自定义参数
- **WHEN** 调用 `renderPreview({ saturationFactor: 2.0, ditherThreshold: 10000, graySpread: 60, grayLuminanceMidpoint: 100 })`
- **THEN** Stage 3 使用 `saturationFactor=2.0`，Stage 3.5 使用 `graySpread=60` 和 `grayLuminanceMidpoint=100`，Stage 4 使用 `ditherThreshold=10000`

### Requirement: PreviewResult 接口扩展
`PreviewResult` 接口 SHALL 新增 `quantizedDataUrl` 和 `colorStats` 字段，保持向后兼容。

#### Scenario: 新字段定义
- **WHEN** `PreviewResult` 接口被使用
- **THEN** SHALL 包含以下可选字段：`quantizedDataUrl?: string`（量化效果图 PNG data URL）、`colorStats?: ColorStats`（6 色使用统计）

#### Scenario: 向后兼容
- **WHEN** 旧代码只读取 `previewDataUrl` 字段
- **THEN** SHALL 不受新增字段影响，原有字段行为不变

### Requirement: RGBA 缓存与快速重量化

渲染管线必须在 `renderPreview()` 的 Stage 2 完成后缓存原始 RGBA 数据。新增 `requantize(params: QuantizationParams): Promise<PreviewResult>` 方法，直接从缓存的 RGBA 数据重跑 Stage 3-5，跳过 Stage 1（数据收集）和 Stage 2（模板渲染）。

#### Scenario: 有缓存时快速重量化

- **WHEN** 已执行过 `renderPreview()` 且存在 RGBA 缓存
- **WHEN** 调用 `requantize(params)`
- **THEN** 跳过 Stage 1-2，从 Stage 3 开始使用新参数重新处理，返回新的 `PreviewResult`

#### Scenario: 无缓存时拒绝

- **WHEN** 尚未执行过 `renderPreview()`（无 RGBA 缓存）
- **WHEN** 调用 `requantize(params)`
- **THEN** 返回 `{ success: false, error: '没有缓存的RGBA数据，请先刷新预览' }`

#### Scenario: 重量化更新帧缓冲区缓存

- **WHEN** `requantize()` 成功完成
- **THEN** `cachedBuffer`（用于 syncToDevice）必须更新为最新量化结果的帧缓冲区

### Requirement: 重量化 IPC 通道

桌面端必须注册 `pipeline:requantize` IPC handler，接受 `QuantizationParams` 参数，调用 `renderPipeline.requantize(params)` 并返回结果。

#### Scenario: IPC 调用重量化

- **WHEN** 渲染进程调用 `window.api.invoke('pipeline:requantize', params)`
- **THEN** 主进程调用 `renderPipeline.requantize(params)` 并返回 `PreviewResult`

#### Scenario: 管线未初始化

- **WHEN** 渲染管线未初始化时调用 `pipeline:requantize`
- **THEN** 返回 `{ success: false, error: 'Pipeline not initialized' }`

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
