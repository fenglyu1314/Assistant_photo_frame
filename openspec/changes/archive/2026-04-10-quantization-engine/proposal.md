## Why

Phase 1-3 已完成，ESP32 固件能通过二进制协议接收 192KB 帧缓冲区并刷屏，桌面端骨架已就位。但 桌面端目前无法将图像转换为墨水屏可显示的帧数据——缺少从 RGBA 像素到 6 色量化 + 物理缓冲区编码的整个管线。

Phase 4 实现 TypeScript 量化引擎，这是后续 Phase 6（完整渲染管线：HTML→截屏→量化→编码→发送→刷屏）的核心前置模块。量化引擎是纯算法模块，无硬件依赖，可独立开发和测试。

## What Changes

- **新增** `companion/src/core/palette.ts` — 6 色调色板定义（索引对齐 Waveshare 硬件枚举，跳过 Orange=4）
- **新增** `companion/src/core/quantizer.ts` — 量化引擎核心：
  - 欧氏距离最近邻量化 (`quantizeNearest`)
  - Floyd-Steinberg 误差扩散抖动量化 (`quantizeFloydSteinberg`)
  - 饱和度预处理 (`enhanceSaturation`)，默认系数 1.4
- **新增** `companion/src/core/buffer-encoder.ts` — 物理缓冲区编码：rotation=3 坐标变换 + 4-bit 打包，输出 192,000 字节 `Uint8Array`
- **新增** `companion/src/core/__tests__/` — 单元测试（量化正确性、坐标变换、缓冲区编码、边界条件）
- **修改** `companion/package.json` — 添加 vitest 测试框架依赖和测试脚本

## Capabilities

### 新增功能
- `epd-quantizer-ts`: TypeScript 版 6 色量化引擎（最近邻 + Floyd-Steinberg 抖动 + 饱和度预处理 + 物理缓冲区编码）

## Impact

- `companion/src/core/` — 新增 3 个核心模块文件
- `companion/src/core/__tests__/` — 新增测试文件
- `companion/package.json` — 添加 vitest 开发依赖
- 不涉及固件变更
- 不涉及协议变更
