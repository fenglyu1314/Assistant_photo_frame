## Why

当前渲染管线 `RenderPipeline.execute()` 将「预览渲染」和「发送到墨水屏」耦合为一个不可分割的原子操作（Stage 1-6 一次性执行）。用户点击「刷新墨水屏」后必须等待整个管线完成（包括约 30 秒的串口传输），才能看到预览图。更严重的是，如果 Stage 6 发送失败，预览图也不会返回给 UI（被错误 return 截断），导致 UI 预览始终为空。用户需要的是：先快速预览渲染效果，确认没问题后再手动同步到墨水屏。

## What Changes

- **拆分渲染管线**：将 `RenderPipeline.execute()` 拆分为 `renderPreview()`（Stage 1-5）和 `syncToDevice()`（Stage 6），两者可独立调用
- **缓存渲染结果**：`renderPreview()` 完成后缓存编码好的帧缓冲区，`syncToDevice()` 直接使用缓存，避免重复渲染
- **新增 IPC 通道**：`pipeline:render-preview` 和 `pipeline:sync-device` 替代原有的 `pipeline:execute`
- **UI 拆分为双按钮**：EpdPreview.vue 的「刷新墨水屏」拆分为「刷新预览」和「同步到墨水屏」两个独立按钮
- **预览立即显示**：渲染完成后预览图立即显示，无需等待设备同步
- **同步按钮条件可用**：「同步到墨水屏」仅在预览已生成且设备已连接时可点击
- **修复预览 Bug**：确保即使设备未连接或发送失败，预览图也能正确显示
- **定时刷新适配**：定时触发改为先渲染预览 + 可选自动同步到墨水屏

## Capabilities

### New Capabilities
- `preview-render`: 独立的预览渲染能力，执行 Stage 1-5 并返回预览图和缓存帧缓冲区
- `device-sync`: 独立的设备同步能力，将已缓存的帧缓冲区发送到墨水屏

### Modified Capabilities
- `render-pipeline`: 管线架构从单一 execute() 拆分为 renderPreview() + syncToDevice()，新增缓存机制
- `companion-ui`: EpdPreview 组件从单按钮改为双按钮，新增同步状态管理
- `scheduled-refresh`: 定时刷新逻辑适配新的两阶段管线

## Impact

**桌面端 (仅 桌面端变更，不涉及固件/协议)**:

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `companion/electron/pipeline/render-pipeline.ts` | 重构 | 拆分 execute() 为 renderPreview() + syncToDevice()，新增缓存 |
| `companion/electron/main.ts` | 修改 | 新增 IPC handler，适配定时刷新逻辑 |
| `companion/src/components/EpdPreview.vue` | 重构 | 双按钮 UI + 状态管理 |

**不涉及的部分**:
- 固件代码（无变更）
- 二进制传输协议（无变更）
- 串口通信层（无变更）
- 量化/编码引擎（无变更）
