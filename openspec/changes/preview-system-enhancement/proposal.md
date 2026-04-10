## Why

当前桌面端预览系统只提供一张 240×400 的缩小原图（量化前的 HTML 截屏），用户无法看到 Floyd-Steinberg 抖动量化后的实际效果，也无法放大查看文字笔画、颜色边界等关键细节。调整模板配色或排版后，必须同步到墨水屏才能验证效果，严重拖慢迭代速度。

## What Changes

- **新增量化效果图生成**：在渲染管线 Stage 4（量化）之后，将 palette indices 还原为 RGB 像素，生成一张 480×800 PNG 作为量化效果图 (`quantizedDataUrl`)，让用户在桌面端直接看到"墨水屏上会显示什么"
- **双图对比 Tab**：EpdPreview.vue 重做为 Tab 切换布局，支持「原图」和「量化图」两个视图
- **多级缩放**：支持 适应窗口（默认）/ 50% / 75% / 100% 四个缩放级别，100% 模式下可 1:1 像素级审查
- **拖拽平移**：缩放后图片超出容器时，支持鼠标拖拽查看不同区域
- **Ctrl+滚轮缩放**：鼠标滚轮快速切换缩放级别
- **量化色彩统计**（可选）：预览区底部显示 6 色使用占比，辅助判断配色合理性
- **量化参数调整面板**：将量化引擎的关键硬编码参数暴露到 UI，用户可交互式调整量化效果
  - 饱和度增强系数（默认 1.4，范围 0.5-3.0）
  - Floyd-Steinberg 抖动阈值（默认 24000，范围 0-50000）
  - 灰色判定极差（默认 40，范围 0-100）
  - 灰色亮度中点（默认 128，范围 50-200）
- **快速重量化**：调参数后仅重跑 Stage 3-5（复用上次渲染 RGBA 数据），~200ms 即出结果
- **恢复默认值**：一键还原所有量化参数

## Capabilities

### New Capabilities
- `quantized-preview`: 量化效果图生成能力——将 palette indices 数组还原为 RGB 像素并输出 PNG dataURL，包含色彩统计信息
- `quantization-params`: 量化参数数据模型定义、默认值管理、参数验证逻辑
- `quantization-params-ui`: 桌面端量化参数调整面板 UI 交互设计与实现

### Modified Capabilities
- `preview-render`: 渲染管线 `renderPreview()` 返回值新增 `quantizedDataUrl` 字段，管线在 Stage 4 后增加量化图生成步骤
- `companion-ui`: EpdPreview 组件重做为双图对比 + 缩放/平移交互
- `epd-quantizer-ts`: 量化引擎函数签名扩展，硬编码常量改为可选参数
- `render-pipeline`: 渲染管线接受量化参数 + 新增快速重量化路径（跳过 Stage 1-2）

## Impact

- **companion/src/core/**：新增 `quantized-preview.ts` 模块（indices → RGB → canvas → PNG）
- **companion/src/core/**：新增 `quantization-params.ts` 模块（参数接口、默认值、验证）
- **companion/src/core/quantizer.ts**：函数签名扩展，常量变为可选参数
- **companion/electron/pipeline/render-pipeline.ts**：`renderPreview()` 增加量化图生成步骤 + 接受量化参数 + 新增 `requantize()` 快速重量化方法
- **companion/src/components/EpdPreview.vue**：整体重做——Tab 切换、缩放控制、拖拽平移 + 量化参数调整面板
- **companion/electron/main.ts**：IPC 返回值变更 + 新增 `pipeline:requantize` handler
- **companion/src/preload.d.ts**：类型更新（如有）
- 不涉及帧协议变更
- 不涉及固件变更
