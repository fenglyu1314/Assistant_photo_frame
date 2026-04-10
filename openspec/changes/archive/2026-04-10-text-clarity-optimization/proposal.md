## Why

Phase 1-8 已完成完整渲染管线，墨水屏能正常显示仪表盘画面。但当前 Floyd-Steinberg 抖动算法对所有像素一视同仁地做误差扩散，导致**纯黑/纯白文字笔画中出现彩色杂点**（绿、蓝、黄等杂色）。

根本原因有两层：
1. **源头层面**：Chromium 截屏时文字抗锯齿产生灰色过渡像素（即使 CSS 已设 `-webkit-font-smoothing: none`，Windows 下 DirectWrite 仍可能引入亚像素渲染残余）
2. **末端层面**：FS 抖动对这些微小误差无条件扩散，累积后导致某些像素的 RGB 分量不平衡，被量化到错误颜色

Phase 9 采用 **A+C 组合方案**（源头 CSS 强化 + 末端阈值保护）解决文字杂色问题，改动量小、风险低。

## What Changes

- **修改** `companion/src/core/quantizer.ts` — `quantizeFloydSteinberg()` 增加阈值保护逻辑：像素到最近调色板颜色的距离 < 阈值时直接映射，跳过误差扩散
- **修改** `companion/templates/epd-design-system.css` — 强化源头限色：禁用 text-shadow/box-shadow/opacity、添加 `font-smooth: never`、强制所有文字元素使用调色板纯色
- **修改** `companion/templates/dashboard.html` — 审查并消除模板中可能引入非调色板颜色的样式（如圆角 border-radius 在低分辨率下产生 AA 像素）
- **修改** `companion/src/core/__tests__/quantizer.test.ts` — 新增阈值保护相关单元测试
- **新增** `companion/src/core/quantizer.ts` 中导出 `DITHER_THRESHOLD_SQ` 常量供外部配置/测试

## Capabilities

### 增强功能
- `epd-text-clarity`: 文字清晰度优化 — 阈值保护 + CSS 限色，确保纯黑/白文字无杂色

## Impact

- `companion/src/core/quantizer.ts` — 修改 FS 抖动算法（新增约 10 行阈值判断）
- `companion/src/core/__tests__/quantizer.test.ts` — 新增测试用例
- `companion/templates/epd-design-system.css` — 强化 CSS 规则
- `companion/templates/dashboard.html` — 微调模板样式
- 不涉及固件变更
- 不涉及帧协议变更
- 不涉及渲染管线流程变更（`render-pipeline.ts` 无需修改）
