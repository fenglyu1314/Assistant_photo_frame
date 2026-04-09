## Context

当前项目需要将 PC 端渲染的 HTML 画面（480×800 RGBA 像素）转换为 ESP32 墨水屏可显示的 192KB 帧缓冲区。参考实现是 Python `tools/img2epd.py`（601 行），需要将其核心算法精确移植为 TypeScript，并利用 TypedArray 提升性能。

量化引擎位于渲染管线的中间环节：

```
HTML/CSS 渲染 → capturePage → RGBA 像素
                                    ↓
                        [量化引擎 - 本次实现]
                           ↓            ↓
                    饱和度增强    6色量化+FS抖动
                                    ↓
                        物理缓冲区编码 (192KB)
                                    ↓
                     二进制帧协议传输 → ESP32 刷屏
```

## Goals / Non-Goals

**Goals:**
- 精确移植 Python `img2epd.py` 的量化算法到 TypeScript
- 使用 TypedArray（Float32Array, Uint8Array）实现高性能计算
- 模块化设计：palette / quantizer / buffer-encoder 分离
- 完备的单元测试覆盖
- 量化结果视觉正确，与 Python 版高度一致

**Non-Goals:**
- 不实现图片加载/缩放（由 Electron capturePage 提供 RGBA 数据）
- 不实现串口传输（Phase 5）
- 不实现离屏渲染/HTML 模板（Phase 6）
- 不追求与 Python 版逐字节一致（允许浮点精度差异）

## Decisions

### D1: 模块拆分方案

```
companion/src/core/
├── palette.ts           # 调色板定义 + 颜色工具
├── quantizer.ts         # 量化算法（最近邻 + Floyd-Steinberg + 饱和度增强）
├── buffer-encoder.ts    # 物理缓冲区编码（坐标变换 + 4-bit 打包）
└── __tests__/
    ├── palette.test.ts
    ├── quantizer.test.ts
    └── buffer-encoder.test.ts
```

**理由**：与参考设计文档 (D8) 一致，每个模块职责单一，便于单元测试和后续复用。

### D2: 数据流与接口约定

```typescript
// 输入：RGBA 像素数据（来自 capturePage → NativeImage → toBitmap）
type RGBABuffer = Uint8Array  // 长度 = width × height × 4

// palette.ts 导出
const EPD_PALETTE: Array<[number, number, number] | null>  // 7 元素，索引 4 = null

// quantizer.ts 导出
function enhanceSaturation(rgba: Uint8Array, width: number, height: number, factor?: number): Uint8Array
function quantizeNearest(rgba: Uint8Array, width: number, height: number): Uint8Array  // 返回索引数组
function quantizeFloydSteinberg(rgba: Uint8Array, width: number, height: number): Uint8Array

// buffer-encoder.ts 导出
function encodeToPhysicalBuffer(indices: Uint8Array, logicalWidth: number, logicalHeight: number): Uint8Array
// 返回 192,000 字节
```

**关键约定**：
- 输入为 RGBA Uint8Array（来自 Electron capturePage），不依赖 Canvas/Image API
- 量化函数输出 Uint8Array 索引数组（每元素 0-6，跳过 4）
- buffer-encoder 输入索引数组，输出 4-bit packed 物理缓冲区

### D3: Floyd-Steinberg 使用 Float32Array

Python 版使用 `float` 列表做误差扩散。TypeScript 版使用 `Float32Array` 的二维展开（长度 = width × height × 3）存储 RGB 浮点值。

**理由**：
- Float32Array 的内存连续性比嵌套数组好得多，缓存友好
- 32-bit 浮点精度足够（误差扩散不需要 64-bit 精度）
- 对 480×800 图像，内存占用 = 480 × 800 × 3 × 4 = 4.6MB，完全可接受

### D4: 饱和度增强使用 RGB↔HSL 转换

Python 版使用 `PIL.ImageEnhance.Color`，其内部做法是将图片与灰度版本按比例混合。TypeScript 版采用逐像素 RGB→HSL→调整 S→HSL→RGB 的方式。

**理由**：
- 不依赖任何图片处理库
- 纯数学计算，结果可预测
- 与 PIL 的 Color enhance 效果相近（都是在色彩饱和度维度操作）

### D5: 测试框架选择 Vitest

| 方案 | 结论 |
|------|------|
| Vitest | ✅ 选用 |
| Jest | ❌ |

**理由**：项目已使用 Vite (electron-vite)，Vitest 与 Vite 生态完美集成，零配置支持 TypeScript，运行速度快。Jest 需要额外配置 TypeScript 转译。

### D6: 坐标变换公式

与 Python `img2epd.py` 和固件 `EPaperDriver::setPixel()` case 3 保持一致：

```
逻辑坐标 (lx, ly) → 物理坐标 (px, py) = (ly, 479 - lx)
物理地址 addr = px / 2 + py × 400
打包规则：偶数 px → 高 4 位，奇数 px → 低 4 位
```

输出缓冲区大小 = 800/2 × 480 = 192,000 字节。

## Risks / Trade-offs

### R1: JS/Python 浮点精度差异
- **风险**：Floyd-Steinberg 抖动中浮点运算累积误差可能导致少量像素与 Python 版不同
- **缓解**：验收标准为「视觉正确」而非逐字节一致；设计测试用纯色和简单图案验证算法正确性

### R2: 性能瓶颈
- **风险**：480×800 图像的 FS 抖动涉及 384,000 像素 × 6 色距离计算 × 4 方向误差扩散
- **缓解**：使用 Float32Array 代替嵌套数组；提前计算调色板距离查找表可作为后续优化方向

### R3: Vitest 与 electron-vite 兼容性
- **风险**：electron-vite 项目结构可能需要额外 vitest 配置
- **缓解**：量化引擎是纯 TypeScript 模块，不依赖 Electron API，vitest 可直接运行
