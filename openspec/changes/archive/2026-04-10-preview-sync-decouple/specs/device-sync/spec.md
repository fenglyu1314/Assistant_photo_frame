## ADDED Requirements

### Requirement: IPC 通道 pipeline:render-preview
主进程 SHALL 注册 `pipeline:render-preview` IPC handler，调用 `RenderPipeline.renderPreview()` 并返回结果。

#### Scenario: 渲染进程触发预览
- **WHEN** 渲染进程调用 `window.api.invoke('pipeline:render-preview')`
- **THEN** 主进程必须调用 `renderPipeline.renderPreview()` 并将结果 `{ success, previewDataUrl?, durationMs?, error? }` 返回给渲染进程

#### Scenario: 管线未初始化时调用
- **WHEN** renderPipeline 尚未初始化时收到 `pipeline:render-preview` 请求
- **THEN** 必须返回 `{ success: false, error: 'Pipeline not initialized' }`

### Requirement: IPC 通道 pipeline:sync-device
主进程 SHALL 注册 `pipeline:sync-device` IPC handler，调用 `RenderPipeline.syncToDevice()` 并返回结果。

#### Scenario: 渲染进程触发同步
- **WHEN** 渲染进程调用 `window.api.invoke('pipeline:sync-device')`
- **THEN** 主进程必须调用 `renderPipeline.syncToDevice()` 并将结果 `{ success, durationMs?, error? }` 返回给渲染进程

#### Scenario: 管线未初始化时调用
- **WHEN** renderPipeline 尚未初始化时收到 `pipeline:sync-device` 请求
- **THEN** 必须返回 `{ success: false, error: 'Pipeline not initialized' }`
