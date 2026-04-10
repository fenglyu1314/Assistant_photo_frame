## 1. 量化效果图生成模块

- [x] 1.1 新建 `companion/src/core/quantized-preview.ts`，定义 `ColorStats` 类型（每色像素数+百分比）和 `QuantizedPreviewResult` 类型（`{ dataUrl: string, colorStats: ColorStats }`）
- [x] 1.2 实现 `indicesToRgba(indices: Uint8Array, width: number, height: number): Uint8Array` 函数：遍历 palette indices，通过 `EPD_PALETTE` 查表还原为 RGBA 像素数组
- [x] 1.3 实现 `indicesToDataUrl(indices, width, height): QuantizedPreviewResult` 函数：调用 `indicesToRgba()` 生成 RGBA，使用 Electron `nativeImage.createFromBuffer()` 转为 PNG data URL，同时统计 6 色使用占比
- [x] 1.4 为 `indicesToRgba()` 和 `indicesToDataUrl()` 编写单元测试：验证输出图片尺寸、颜色映射正确性、统计准确性

## 2. 渲染管线集成

- [x] 2.1 扩展 `PreviewResult` 接口：新增 `quantizedDataUrl?: string` 和 `colorStats?: ColorStats` 可选字段
- [x] 2.2 在 `render-pipeline.ts` 的 `renderPreview()` 中，Stage 4 量化完成后调用 `indicesToDataUrl(indices, EPD_LOGICAL_W, EPD_LOGICAL_H)` 生成量化效果图
- [x] 2.3 将 `quantizedDataUrl` 和 `colorStats` 添加到 `renderPreview()` 的返回值中
- [x] 2.4 更新 `companion/electron/main.ts` 中 IPC handler `pipeline:render-preview` 的返回值，确保新字段透传到渲染进程

## 3. EpdPreview.vue 重做 — 双图对比

- [x] 3.1 新增 Tab 切换 UI：「原图」/「量化图」两个 Tab，使用 `ref<'original' | 'quantized'>` 管理当前选中 Tab，默认选中「量化图」
- [x] 3.2 存储双图 data URL：`previewSrc`（原图）和 `quantizedSrc`（量化图），预览完成后同时更新两个 ref
- [x] 3.3 预览区根据当前 Tab 展示对应图片，两个 Tab 共享同一个缩放/平移容器

## 4. EpdPreview.vue 重做 — 缩放与平移

- [x] 4.1 提取 `useZoomPan()` composable：管理 zoomLevel ref（'fit' | '50' | '75' | '100'）、计算 CSS transform scale 值、提供缩放切换方法
- [x] 4.2 实现缩放控制栏 UI：4 个按钮（适应/50%/75%/100%），高亮当前级别
- [x] 4.3 实现预览容器 overflow 滚动：缩放后图片超出容器时显示滚动条，设置 `image-rendering: pixelated` 保持像素硬边缘
- [x] 4.4 实现 Ctrl+滚轮缩放：监听 `wheel` 事件，Ctrl 按下时切换缩放级别
- [x] 4.5 实现鼠标拖拽平移：mousedown → mousemove 修改容器 scrollLeft/scrollTop，拖拽时 cursor 变为 `grab`/`grabbing`

## 5. 色彩统计展示

- [x] 5.1 在 EpdPreview.vue 预览区底部新增色彩统计条：显示 6 色色块 + 百分比文字
- [x] 5.2 存储 `colorStats` ref，预览完成后更新，每种颜色用对应的 CSS 背景色展示

## 6. 集成测试与验证

- [x] 6.1 桌面端 build 验证：`npm run build` 编译通过
- [x] 6.2 端到端功能验证：刷新预览后 Tab 切换正常、缩放各级别工作、拖拽平移流畅、色彩统计显示正确
- [x] 6.3 现有单元测试回归：`npm run test` 全部通过

## 7. 量化参数数据模型

- [x] 7.1 新建 `companion/src/core/quantization-params.ts`，定义 `QuantizationParams` 接口（4 个必填字段：`saturationFactor`、`ditherThreshold`、`graySpread`、`grayLuminanceMidpoint`）和 `DEFAULT_QUANTIZATION_PARAMS` 冻结常量
- [x] 7.2 实现 `getDefaultParams(): QuantizationParams` 函数，返回默认值副本
- [x] 7.3 实现 `validateParams(params: Partial<QuantizationParams>): QuantizationParams` 函数，将部分参数与默认值合并并 clamp 到有效范围
- [x] 7.4 为 `getDefaultParams()` 和 `validateParams()` 编写单元测试：验证默认值正确、范围钳制、部分参数合并、空输入返回默认值

## 8. 量化引擎函数签名扩展

- [x] 8.1 修改 `quantizeFloydSteinberg()` 函数签名，新增可选参数 `ditherThreshold?: number`，内部使用 `ditherThreshold ?? DITHER_THRESHOLD_SQ`
- [x] 8.2 修改 `preprocessGrayPixels()` 函数签名，新增可选参数 `graySpread?: number` 和 `grayLuminanceMidpoint?: number`，内部使用 `graySpread ?? GRAY_SPREAD_THRESHOLD` 和 `grayLuminanceMidpoint ?? GRAY_LUMINANCE_MIDPOINT`
- [x] 8.3 确认 `enhanceSaturation()` 的 `factor` 参数已支持外部传入（无需修改，仅验证）
- [x] 8.4 补充单元测试：验证不传可选参数时行为不变、传入自定义参数时使用传入值

## 9. 渲染管线量化参数集成

- [x] 9.1 修改 `renderPreview()` 签名为 `renderPreview(params?: QuantizationParams)`，将参数传递给 Stage 3 `enhanceSaturation()`、Stage 3.5 `preprocessGrayPixels()`、Stage 4 `quantizeFloydSteinberg()`
- [x] 9.2 在 `renderPreview()` 的 Stage 2 完成后缓存原始 RGBA 数据到 `this.cachedRgba: Uint8Array | null`
- [x] 9.3 新增 `requantize(params: QuantizationParams): Promise<PreviewResult>` 方法，从 `cachedRgba` 开始重跑 Stage 3-5，跳过 Stage 1-2
- [x] 9.4 在 `requantize()` 成功后更新 `cachedBuffer`（帧缓冲区缓存），确保 `syncToDevice()` 使用最新量化结果

## 10. IPC 通道注册

- [x] 10.1 在 `companion/electron/main.ts` 注册 `pipeline:requantize` IPC handler，接受 `{ params: QuantizationParams }` 参数，调用 `renderPipeline.requantize(params)`
- [x] 10.2 确认 `pipeline:render-preview` handler 无需修改（`renderPreview()` 不传参数时使用默认值，保持向后兼容）

## 11. 桌面端 UI — 量化参数面板

- [x] 11.1 在 `EpdPreview.vue` 色彩统计条下方新增可折叠的"量化参数"面板容器，默认收起，点击标题栏展开/收起
- [x] 11.2 添加 4 个参数 slider 控件：饱和度增强（0.5-3.0, step 0.1）、抖动阈值（0-50000, step 1000）、灰色极差（0-100, step 5）、灰色亮度中点（50-200, step 1），每个 slider 右侧显示当前数值
- [x] 11.3 实现"恢复默认值"按钮，点击后将 4 个 slider 重置为默认值
- [x] 11.4 实现 300ms debounce 自动触发：slider 值变化后延迟 300ms 调用 `pipeline:requantize` IPC，更新量化图和色彩统计
- [x] 11.5 无 RGBA 缓存时（未刷新预览），参数面板显示"请先刷新预览"提示，slider 禁用
- [x] 11.6 重量化执行中显示简短加载指示（如"重新量化中..."文字），完成后消失

## 12. 最终验证

- [x] 12.1 桌面端 build 验证：`npm run build` 编译通过
- [x] 12.2 单元测试回归：`npm run test` 全部通过
- [x] 12.3 端到端功能验证：刷新预览 → 展开参数面板 → 调整 slider → 量化图实时更新 → 恢复默认值 → 同步到墨水屏正常
