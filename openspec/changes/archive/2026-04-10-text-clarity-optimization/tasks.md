## 1. 量化引擎 — 阈值保护

- [x] 1.1 在 `companion/src/core/quantizer.ts` 中新增 `DITHER_THRESHOLD_SQ` 导出常量（默认值 3000）
- [x] 1.2 新增 `nearestPaletteIndexWithDist(r, g, b)` 函数，返回 `{ palIdx, distSq }`，保持原有 `nearestPaletteIndex()` 不变
- [x] 1.3 修改 `quantizeFloydSteinberg()`：在 FS 循环中调用 `nearestPaletteIndexWithDist` 替代 `nearestPaletteIndex`，当 `distSq < DITHER_THRESHOLD_SQ` 时跳过误差扩散（`continue`），否则执行原有误差计算和扩散逻辑

## 2. 单元测试

- [x] 2.1 在 `companion/src/core/__tests__/quantizer.test.ts` 中新增 `nearestPaletteIndexWithDist` 测试：验证纯黑/纯白/纯红返回 distSq=0，近黑色 (20,20,20) 返回 distSq=1200 且 palIdx=0
- [x] 2.2 新增阈值保护测试：构造一行近黑色像素 (例如全部填充 (20,20,20))，验证 `quantizeFloydSteinberg` 输出全部为 BLACK(0)，无杂色出现
- [x] 2.3 新增灰色正常抖动测试：构造一行灰色像素 (128,128,128)，验证 `quantizeFloydSteinberg` 输出中同时包含 BLACK(0) 和 WHITE(1)（即正常抖动未被阈值拦截）
- [x] 2.4 运行 `npm run test` 确认所有测试通过（包括原有 54+ 个测试和新增测试）

## 3. CSS 源头治理

- [x] 3.1 修改 `companion/templates/epd-design-system.css`：在 `*` 选择器中补充 `font-smooth: never`、`text-shadow: none !important`、`box-shadow: none !important`、`filter: none !important`
- [x] 3.2 修改 `companion/templates/dashboard.html`：将 `.event-dot` 的 `border-radius: 50%` 改为 `transform: rotate(45deg)` 菱形样式（或移除 border-radius 改为方形），消除小尺寸圆形的 AA 灰边

## 4. 集成验证

- [x] 4.1 运行 `npm run test` 确认所有单元测试通过
- [x] 4.2 运行 `npm run build` 确认 TypeScript 编译无错误
