## Context

当前渲染管线：HTML/CSS 模板 → 截屏(480×800 RGBA) → 饱和度增强 → Floyd-Steinberg 抖动量化 → 物理缓冲区编码 → 发送到墨水屏。

FS 抖动对所有像素无差别扩散误差，导致文字区域（接近纯黑/纯白的像素）因微小误差累积产生彩色杂点。本次优化采用**源头治理 + 末端保护**的双层策略。

## Goals / Non-Goals

**Goals:**
- 消除纯黑/纯白文字笔画中的彩色杂点
- 保持非文字区域（图片、色块、抖动混色区域）的正常 FS 抖动效果
- 改动量最小化，不改变渲染管线流程和接口

**Non-Goals:**
- 不实现 CIELab 色差计算（留作后续优化方向）
- 不实现分层渲染方案（复杂度过高）
- 不实现调色板 RGB 值微调（需实物测色，后续按需实施）
- 不改变 `quantizeFloydSteinberg` 的函数签名（保持向后兼容）

## Decisions

### D1: 末端保护 — 阈值跳过策略

在 `quantizeFloydSteinberg()` 的像素处理循环中，找到最近调色板颜色后增加一步判断：

```typescript
const DITHER_THRESHOLD_SQ = 3000 // RGB 欧氏距离平方阈值

// 在 FS 循环内，计算 palIdx 时同时获取 distSq
const { palIdx, distSq } = nearestPaletteIndexWithDist(cr, cg, cb)
indices[idx] = palIdx

if (distSq < DITHER_THRESHOLD_SQ) {
  // 像素足够接近调色板色 → 直接映射，不扩散误差
  continue
}

// else: 正常计算误差并扩散（原有逻辑不变）
```

**阈值选择依据**：
- `DITHER_THRESHOLD_SQ = 3000` 意味着 RGB 每个分量偏差约 ±31 以内（√(3000/3) ≈ 31.6）
- 截屏抗锯齿产生的文字边缘灰色过渡像素：典型值 (30,30,30) 到 BLACK 的 distSq = 2700，在阈值内
- 需要正常抖动的中间色：灰色 (128,128,128) 到 BLACK 的 distSq = 49152，远超阈值
- 阈值导出为命名常量，便于后续实验调参

**保护范围**：保护所有 6 色而非仅黑白。理由：彩色文字（红色标题、蓝色链接）同样需要清晰显示，且阈值足够小不会干扰正常抖动区域。

### D2: 新增辅助函数 nearestPaletteIndexWithDist

当前 `nearestPaletteIndex()` 只返回 palIdx，不返回距离值。FS 抖动中需要同时获取 palIdx 和 distSq，避免重复计算。

```typescript
export function nearestPaletteIndexWithDist(
  r: number, g: number, b: number
): { palIdx: number; distSq: number } {
  let bestIdx = 0
  let bestDist = Infinity
  for (const [idx, pr, pg, pb] of VALID_COLORS) {
    const d = colorDistanceSq(r, g, b, pr, pg, pb)
    if (d < bestDist) {
      bestDist = d
      bestIdx = idx
    }
  }
  return { palIdx: bestIdx, distSq: bestDist }
}
```

原有 `nearestPaletteIndex()` 保持不变（被 `quantizeNearest` 使用），避免破坏现有接口。

### D3: 源头治理 — CSS 强化

当前 `epd-design-system.css` 已有 `-webkit-font-smoothing: none` 和 `image-rendering: pixelated`，但还不够彻底。需补充：

```css
* {
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: unset;
  font-smooth: never;               /* NEW */
  text-rendering: optimizeSpeed;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  /* 禁用所有可能产生非调色板像素的效果 */
  text-shadow: none !important;      /* NEW */
  box-shadow: none !important;       /* NEW */
  filter: none !important;           /* NEW */
}
```

### D4: 模板样式审查

检查 `dashboard.html` 中可能在低分辨率下产生 AA 像素的 CSS 属性：
- `border-radius: 50%` (用于 `.event-dot`) — 小圆在 8×8px 下边缘会产生大量灰色 AA 像素，改为方形或菱形
- `border: 1px solid` 细线 — 确认使用调色板色，1px 宽度在 480px 分辨率下是安全的
- `text-decoration: line-through` — 可能产生亚像素渲染，但影响很小，暂不处理

### D5: 阈值常量设计

```typescript
/** 
 * RGB 欧氏距离平方阈值。
 * 像素到最近调色板颜色的 distSq 小于此值时，直接映射，不参与 FS 误差扩散。
 * 默认 3000 约等于每通道 ±31 的容差。
 */
export const DITHER_THRESHOLD_SQ = 3000
```

导出为公开常量，测试可引用，后续也可考虑做成可配置参数。

## Risks / Trade-offs

### R1: 阈值过大导致色阶断裂
- **风险**：如果 `DITHER_THRESHOLD_SQ` 设置过大，本应通过抖动产生过渡效果的区域（如灰色背景）会被强制映射到纯黑或纯白，造成明显的色阶断裂
- **缓解**：默认值 3000 经过计算，仅覆盖"明显接近调色板色"的像素（每通道 ±31）；灰色 (128,128,128) 距任何调色板色都远超此阈值；通过单元测试验证灰色区域仍然正常抖动

### R2: Windows 下 CSS 禁用 AA 效果有限
- **风险**：Chromium 在 Windows 下使用 DirectWrite 渲染字体，`-webkit-font-smoothing: none` 可能无法完全禁用抗锯齿
- **缓解**：这正是采用 A+C 组合方案的原因——源头治理能减少大部分灰边像素，剩余的由末端阈值保护兜底

### R3: 圆形元素样式变更
- **风险**：`.event-dot` 从圆形改为方形/菱形可能影响视觉美观
- **缓解**：在 8×8px 尺寸下圆形和方形视觉差异极小；菱形（45° 旋转的方形）是一个兼顾美观和清晰度的折中方案
