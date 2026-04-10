## Context

当前桌面端的预览系统（`EpdPreview.vue` + `RenderPipeline`）只返回一张量化前的原始截屏 PNG（`previewDataUrl`），以 240×400（1:2 缩放）固定尺寸展示。用户无法看到 Floyd-Steinberg 抖动量化后的实际效果，也无法放大查看文字笔画、色块边界等细节。

渲染管线当前 5 阶段（collect → render → enhance → quantize → encode）中，Stage 4 产出的 `indices` 数组（Uint8Array, 384000 个 palette index）被直接编码为物理缓冲区，从未被还原为可视化图像。

## Goals / Non-Goals

**Goals:**

- 在管线 Stage 4 后新增量化图还原步骤，生成 480×800 PNG，让用户无需同步到墨水屏就能看到量化效果
- 重做 EpdPreview.vue，支持原图/量化图 Tab 切换和多级缩放/拖拽交互
- 保持与现有 IPC 接口的向后兼容（新增字段，不破坏旧字段）
- 可选提供 6 色使用占比统计
- 将 4 个量化参数暴露到桌面端 UI，用户可交互式调整
- 参数调整后快速重新量化（跳过 Stage 1-2 复用上次渲染的 RGBA 数据），实现秒级反馈
- 提供"恢复默认值"一键还原能力

**Non-Goals:**

- 不实现"编辑即预览"自动刷新（用户明确不需要）
- 不修改量化算法本身（Phase 9 已优化完成）
- 不涉及固件改动
- 不涉及帧协议变更
- 不实现多模板切换（Phase 12 范围）
- 不持久化量化参数到 config-store（本期参数仅在预览会话中临时生效，关闭后重置为默认值）
- 不支持自定义调色板 RGB 值（调色板由硬件决定不可改）
- 不暴露 Floyd-Steinberg 误差扩散系数（7/16, 3/16, 5/16, 1/16 是算法标准不应调整）
- 不新增量化算法（如 Atkinson 抖动等）

## Decisions

### Decision 1: 量化图生成位置 — 放在 core 层独立模块

**选择**：新增 `companion/src/core/quantized-preview.ts`，导出 `indicesToDataUrl(indices, width, height)` 纯函数。

**替代方案**：
- (A) 直接在 `render-pipeline.ts` 内联实现 → 污染管线编排代码，且无法单独测试
- (B) 放在 `quantizer.ts` 中 → 该文件职责是"量化"，不应包含"反向可视化"

**理由**：保持单一职责。indices → RGB → Canvas → PNG 是一个独立的可视化关注点，与量化算法正交。放在 core 层也便于未来在渲染进程中复用（如果需要前端直接渲染量化预览）。

### Decision 2: Canvas → PNG 的环境 — 使用 Electron 主进程 OffscreenCanvas

**选择**：在主进程中使用 Node.js Canvas（`@napi-rs/canvas` 或 Electron 内置的 `nativeImage` + 手动 RGBA 写入）。

**替代方案**：
- (A) 在离屏 BrowserWindow 中通过 DOM Canvas 生成 → 需要额外 IPC 来回，增加复杂度
- (B) 纯 TypeScript 手动编码 PNG → 性能好但实现复杂

**理由**：Electron 主进程已有 `nativeImage.createFromBuffer()` 可以直接从 RGBA 创建 NativeImage 并 `toDataURL()`，无需引入额外依赖。indices → RGBA → NativeImage → PNG dataURL 三步完成，代码量小且零依赖。

### Decision 3: 色彩统计 — 在量化图生成时顺便计算

**选择**：`indicesToDataUrl()` 返回 `{ dataUrl: string, colorStats: ColorStats }`，统计每个 palette index 的像素数量和占比。

**理由**：遍历 indices 数组时顺便统计，几乎零额外开销。统计信息对调色很有价值，且只增加一个 for 循环。

### Decision 4: 缩放交互 — CSS transform + overflow scroll

**选择**：预览图容器 `overflow: auto`，图片通过 CSS `transform: scale()` 缩放，超出容器时自动出现滚动条。拖拽使用 mousedown/mousemove 事件控制 `scrollLeft/scrollTop`。

**替代方案**：
- (A) Canvas 绘制 + 自行管理视口 → 过于复杂
- (B) CSS `object-fit` + `zoom` → `zoom` 非标准属性，跨平台行为不一致

**理由**：`transform: scale()` 是标准 CSS，渲染性能好（GPU 加速），配合 `overflow: auto` 的 scroll 容器天然支持溢出滚动。拖拽只需监听鼠标事件修改 scroll 偏移，代码简洁。

### Decision 5: EpdPreview.vue 架构 — 保持单文件组件

**选择**：不拆分为子组件，在 EpdPreview.vue 内用 `ref<'original' | 'quantized'>` 管理当前 Tab，缩放/拖拽逻辑用 composable 函数抽取。

**理由**：预览区域是一个内聚的功能单元，Tab/缩放/拖拽紧密关联。拆分反而增加 props 传递复杂度。但缩放+拖拽的交互逻辑可提取为 `useZoomPan()` composable 保持可维护性。

### Decision 6: 快速重量化路径（requantize）

**选择**：在 RenderPipeline 中新增 `requantize(params)` 方法，缓存 Stage 2 输出的原始 RGBA 数据，重量化时从 Stage 3 重跑。

**理由**：
- 完整 `renderPreview()` 包含数据收集（网络请求）+ 模板渲染（Offscreen BrowserWindow），耗时 2-5 秒
- 量化引擎本身仅需 ~100ms（480×800 = 384K 像素），加上饱和度增强 ~50ms，总共 ~200ms
- 用户调滑块时希望快速看到效果变化，2-5 秒延迟会严重影响体验

**替代方案**：前端拿到 RGBA 数据后在 renderer 进程中直接调用量化（避免 IPC 往返）。但量化需要 Float32Array 大量内存和 CPU 计算，放在 renderer 进程会阻塞 UI。

### Decision 7: 参数通过 options 对象传递

**选择**：定义 `QuantizationParams` 接口，量化函数通过可选的 options 参数接收，未传时使用模块级默认值。

```typescript
interface QuantizationParams {
  saturationFactor: number    // 默认 1.4
  ditherThreshold: number     // 默认 24000
  graySpread: number          // 默认 40
  grayLuminanceMidpoint: number // 默认 128
}
```

**理由**：保持现有 API 向后兼容（不传参时行为不变），同时允许调用方覆盖任意参数。

### Decision 8: UI 布局——可折叠参数面板

**选择**：在 EpdPreview.vue 预览区域下方、色彩统计条下方放置可折叠的"量化参数"面板，默认收起。

**理由**：
- 参数调整是高级功能，默认收起不干扰普通用户
- 放在预览区下方符合"先看效果→再调参数→再看效果"的工作流
- 参数面板使用 range slider + 数值输入框组合，提供精确与粗调两种交互

### Decision 9: 防抖触发重量化

**选择**：用户拖动 slider 时使用 300ms debounce 触发重量化 IPC 调用，避免滑块拖动过程中密集触发管线。

**理由**：量化 ~200ms + IPC 往返 ~20ms ≈ 每次 ~220ms，300ms debounce 确保滑块松手后只触发一次。用户连续拖动时不会堆积请求。

## Risks / Trade-offs

- **[性能] 量化图生成增加耗时** → 384000 个 indices 遍历 + NativeImage 创建预计 <50ms，相对于渲染+量化的 1-3s 可忽略。如果意外过慢，可改为异步 worker 或延迟生成。

- **[内存] 额外保存一张 480×800 PNG dataURL** → 约 200-400KB（PNG 压缩后），对桌面端内存无影响。

- **[NativeImage 依赖]** Electron 的 `nativeImage.createFromBuffer()` 要求 RGBA 格式和精确的 size 参数。如果 API 行为在 Electron 版本间变化，需要适配 → 风险低，该 API 稳定存在多年。

- **[缩放体验] CSS transform scale 可能导致像素模糊** → 在 100% 模式下 scale=1 无问题；其他缩放级别下 `image-rendering: pixelated` 可保持硬边缘。

- **[风险] RGBA 缓存增加内存占用** → 缓存 480×800×4 = 1.5MB RGBA 数据在内存中。1.5MB 对桌面应用微不足道，且只缓存一份。

- **[风险] 量化参数范围不当导致视觉异常** → 极端参数（如 ditherThreshold=0 + graySpread=0）会产生满屏彩色噪点。缓解: UI 限制参数范围 + 提供"恢复默认值"按钮 + 参数说明提示文字。

- **[权衡] 参数不持久化** → 本期不存储参数到 config-store，关闭窗口后重置。这是有意为之：量化参数更多是"调到满意后同步到墨水屏"的一次性调整，而非需要记住的偏好设置。如果用户反馈需要记忆，下期可加持久化。
