## 1. RenderPipeline 拆分与缓存

- [x] 1.1 新增 `PipelineStatus.hasCache` 字段和 `PreviewResult` / `SyncResult` 类型定义
- [x] 1.2 新增 `cachedBuffer` 和 `cachedPreviewDataUrl` 私有字段
- [x] 1.3 实现 `renderPreview()` 方法：执行 Stage 1-5（收集→渲染→增强→量化→编码），将帧缓冲区和 previewDataUrl 写入缓存，返回 `{ success, previewDataUrl, durationMs }`
- [x] 1.4 实现 `syncToDevice()` 方法：检查缓存是否存在，存在则执行 Stage 6（发送），返回 `{ success, durationMs, error? }`
- [x] 1.5 重构 `execute()` 方法：改为内部依次调用 `renderPreview()` + `syncToDevice()`，保持返回类型不变；即使 syncToDevice 失败也返回 previewDataUrl
- [x] 1.6 更新 `getStatus()` 返回 `hasCache` 字段

## 2. IPC 通道注册

- [x] 2.1 在 `main.ts` 的 `setupPipelineIPC()` 中注册 `pipeline:render-preview` handler
- [x] 2.2 在 `main.ts` 的 `setupPipelineIPC()` 中注册 `pipeline:sync-device` handler
- [x] 2.3 保留 `pipeline:execute` 和 `pipeline:status` handler 不变

## 3. EpdPreview.vue 双按钮 UI 重构

- [x] 3.1 将 "刷新墨水屏" 按钮拆分为 "刷新预览" 和 "同步到相框" 两个按钮
- [x] 3.2 实现 `executePreview()` 方法：调用 `pipeline:render-preview`，成功后立即显示预览图
- [x] 3.3 实现 `executeSync()` 方法：调用 `pipeline:sync-device`，显示传输进度
- [x] 3.4 同步按钮状态管理：监听 `serial:state-changed` 获取设备连接状态，监听 `pipeline:status` 获取缓存状态，仅在 hasCache + connected 时启用同步按钮
- [x] 3.5 进度指示器适配：预览操作显示 Stage 1-5 进度，同步操作显示 Stage 6 传输进度
- [x] 3.6 预览区域点击保持为触发预览刷新（而非完整管线执行）

## 4. 定时刷新适配

- [x] 4.1 确认 `setupScheduledRefresh()` 中的定时回调继续使用 `renderPipeline.execute()`（无需改动，内部已重构为 renderPreview + syncToDevice）
- [x] 4.2 验证设备连接时的首次执行 `renderPipeline.execute()` 行为正确

## 5. 集成验证

- [x] 5.1 验证「刷新预览」：点击后 2-3 秒内显示预览图，不触发串口发送
- [x] 5.2 验证「同步到相框」：点击后将缓存帧发送到设备，墨水屏正确刷新
- [x] 5.3 验证设备未连接时：预览正常工作，同步按钮禁用
- [x] 5.4 验证定时刷新：设备连接后定时执行完整管线（预览+同步）
- [x] 5.5 构建验证：执行 `npm run build` 确认编译通过（用户手动执行）
