## Context

当前 `RenderPipeline.execute()` 是一个包含 6 个阶段的原子操作（Stage 1: 收集 → Stage 2: 渲染 → Stage 3: 增强 → Stage 4: 量化 → Stage 5: 编码 → Stage 6: 发送）。用户点击"刷新墨水屏"后，必须等待整个管线完成（含约 30 秒串口传输）才能看到预览图。若 Stage 6 失败（设备未连接等），`previewDataUrl` 虽在 Stage 2 已生成，但因提前 return 而不返回给 UI，导致预览始终为空。

关键约束：
- 仅修改 桌面端代码，不涉及固件或协议
- 保持 preload.ts 的通用 IPC 桥接不变（invoke/on/off/send 已足够）
- 已有的量化/编码引擎和串口通信层不做改动

## Goals / Non-Goals

**Goals:**
- 将渲染预览和设备同步解耦为两个独立操作
- 修复预览图不显示的 Bug（无论设备是否连接，预览图都能正确回显）
- 用户可先快速预览渲染效果（~2 秒），确认后再手动同步到墨水屏（~30 秒）
- 定时刷新机制适配新的两阶段管线

**Non-Goals:**
- 不更改固件代码
- 不更改二进制传输协议
- 不更改串口通信层 (serial-manager.ts)
- 不新增传输方式（WiFi 等）
- 不增加新模板
- 不优化量化算法（Phase 9 范围）

## Decisions

### Decision 1: RenderPipeline 拆分为 renderPreview() + syncToDevice()

**选择**: 在 `RenderPipeline` 类中新增 `renderPreview()` 和 `syncToDevice()` 两个公开方法，保留 `execute()` 作为向后兼容的快捷方法（内部调用 renderPreview + syncToDevice）。

**方案对比**:
- **方案 A**: 拆分为两个方法 + 保留 execute() ← **选择**
- **方案 B**: 完全移除 execute()，所有调用方都改为两步调用
- **方案 C**: 新建一个 PreviewPipeline 类独立于 RenderPipeline

选择方案 A 因为：最小化改动范围，定时刷新仍可一步调用 execute()，新的手动操作用两步调用。

### Decision 2: 帧缓冲区缓存在 RenderPipeline 实例内

**选择**: 在 `RenderPipeline` 中新增 `cachedBuffer: Buffer | null` 和 `cachedPreviewDataUrl: string | null` 字段。`renderPreview()` 完成后写入缓存，`syncToDevice()` 读取缓存发送。

**理由**: 避免通过 IPC 传输 192KB 二进制数据（序列化/反序列化开销大），缓存在主进程内直接使用。

### Decision 3: 新增两个 IPC 通道

**选择**: 
- `pipeline:render-preview` → 调用 `renderPreview()`，返回 `{ success, previewDataUrl, durationMs, error? }`
- `pipeline:sync-device` → 调用 `syncToDevice()`，返回 `{ success, durationMs, error? }`
- 保留 `pipeline:execute` 和 `pipeline:status` 不变

**理由**: 渲染进程需要独立触发预览和同步。保留 execute 通道避免破坏定时刷新等现有功能。

### Decision 4: EpdPreview.vue 双按钮 + 状态机

**选择**: 
- 「刷新预览」按钮：调用 `pipeline:render-preview`，渲染完成后立即显示预览图
- 「同步到墨水屏」按钮：调用 `pipeline:sync-device`，仅在满足两个条件时可用：① 预览已生成（有缓存）② 设备已连接
- 进度指示器根据当前操作（预览/同步）显示不同的阶段子集

**理由**: 用户明确表达需要"先看效果，确认后再同步"的工作流。

### Decision 5: 定时刷新保持使用 execute()

**选择**: 定时刷新仍然调用 `renderPipeline.execute()`（渲染+同步一步完成），因为定时场景不需要人工确认。

**方案对比**:
- **方案 A**: 定时调用 execute() ← **选择**
- **方案 B**: 定时调用 renderPreview() + syncToDevice() 两步

选择方案 A 因为：定时刷新是后台自动行为，无需用户确认，一步执行更简洁。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **缓存占用内存** — 192KB 帧缓冲区 + PNG DataURL (~100KB) 常驻内存 | 低：~300KB 对桌面端可忽略 | 可在下次 renderPreview() 时覆盖旧缓存 |
| **缓存过期** — 用户渲染预览后修改了待办/日程，但直接同步旧缓存 | 中：同步到墨水屏的内容与当前数据不一致 | 在 UI 上标注"预览内容可能已过期"，或数据变更时自动清除缓存提示重新渲染 |
| **并发控制复杂化** — 两个方法共享 running 状态 | 低：沿用现有 running 标志，renderPreview 和 syncToDevice 互斥 | running 标志同时保护两个方法 |
