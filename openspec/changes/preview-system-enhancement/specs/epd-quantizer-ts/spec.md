## MODIFIED Requirements

### 需求:Floyd-Steinberg 阈值保护

量化引擎的 Floyd-Steinberg 抖动模式必须支持**阈值保护**：当像素到最近调色板颜色的 RGB 欧氏距离平方小于阈值时，直接映射到该调色板颜色，**不执行误差扩散**。

阈值必须通过可选的 `ditherThreshold` 参数传入。当未传入时，使用模块级默认值 `DITHER_THRESHOLD_SQ = 24000`。

函数签名变更：
```typescript
quantizeFloydSteinberg(
  rgba: Uint8Array,
  width: number,
  height: number,
  ditherThreshold?: number   // 新增可选参数，默认 DITHER_THRESHOLD_SQ
): Uint8Array
```

#### 场景:未传阈值参数时使用默认值

- **WHEN** 调用 `quantizeFloydSteinberg(rgba, w, h)` 不传 `ditherThreshold`
- **THEN** 行为与修改前完全一致，使用 `DITHER_THRESHOLD_SQ = 24000`

#### 场景:传入自定义阈值

- **WHEN** 调用 `quantizeFloydSteinberg(rgba, w, h, 0)`
- **THEN** 阈值保护完全禁用，所有像素都执行误差扩散

#### 场景:传入高阈值

- **WHEN** 调用 `quantizeFloydSteinberg(rgba, w, h, 50000)`
- **THEN** 大部分像素跳过误差扩散，退化为接近最近邻量化的效果

### 需求:灰色像素预处理

量化引擎必须在 Floyd-Steinberg 抖动**之前**对灰色像素进行二值化预处理。灰色判定和二值化的阈值必须通过可选参数传入。

函数签名变更：
```typescript
preprocessGrayPixels(
  rgba: Uint8Array,
  width: number,
  height: number,
  graySpread?: number,          // 新增可选参数，默认 GRAY_SPREAD_THRESHOLD
  grayLuminanceMidpoint?: number // 新增可选参数，默认 GRAY_LUMINANCE_MIDPOINT
): Uint8Array
```

#### 场景:未传参数时使用默认值

- **WHEN** 调用 `preprocessGrayPixels(rgba, w, h)` 不传额外参数
- **THEN** 行为与修改前完全一致，使用 `GRAY_SPREAD_THRESHOLD = 40` 和 `GRAY_LUMINANCE_MIDPOINT = 128`

#### 场景:传入自定义灰色极差

- **WHEN** 调用 `preprocessGrayPixels(rgba, w, h, 80, 128)`
- **THEN** 通道极差 ≤ 80 的像素被判定为灰色并二值化（比默认 40 更宽松）

#### 场景:传入 0 禁用灰色预处理

- **WHEN** 调用 `preprocessGrayPixels(rgba, w, h, 0, 128)`
- **THEN** 只有完全无色差（R=G=B）的像素被二值化，实质上接近禁用预处理
