## 1. 项目配置

- [x] 1.1 安装 vitest 测试框架：在 `companion/` 目录下添加 `vitest` 开发依赖，在 `package.json` 中添加 `"test": "vitest run"` 和 `"test:watch": "vitest"` 脚本，创建或更新 vitest 配置（可内联到 `electron.vite.config.ts` 或单独 `vitest.config.ts`）
- [x] 1.2 创建 `companion/src/core/` 目录结构和 `__tests__/` 测试目录

## 2. 调色板模块

- [x] 2.1 创建 `companion/src/core/palette.ts`：定义 `EPD_PALETTE` 数组（7 元素，索引 4 为 null）、`PALETTE_NAMES` 数组、`ColorIndex` 类型、EPD 物理常量（`EPD_LOGICAL_W=480`, `EPD_LOGICAL_H=800`, `EPD_RAW_W=800`, `EPD_RAW_H=480`, `FRAME_BUFFER_SIZE=192000`）
- [x] 2.2 创建 `companion/src/core/__tests__/palette.test.ts`：验证调色板 RGB 值、索引 4 为 null、常量正确

## 3. 量化引擎

- [x] 3.1 创建 `companion/src/core/quantizer.ts`：实现 `colorDistanceSq(r1,g1,b1, r2,g2,b2)` 欧氏距离平方函数和 `nearestPaletteIndex(r,g,b)` 最近颜色查找函数
- [x] 3.2 实现 `quantizeNearest(rgba: Uint8Array, width: number, height: number): Uint8Array`：逐像素最近邻量化，返回颜色索引数组
- [x] 3.3 实现 `quantizeFloydSteinberg(rgba: Uint8Array, width: number, height: number): Uint8Array`：使用 Float32Array 存储误差缓冲区，实现 7/16、3/16、5/16、1/16 四向误差扩散，clamp [0,255]，四舍五入后查表
- [x] 3.4 实现 `enhanceSaturation(rgba: Uint8Array, width: number, height: number, factor?: number): Uint8Array`：逐像素 RGB→HSL 转换，S 乘以 factor（默认 1.4），clamp [0,1]，HSL→RGB 转回，返回新 Uint8Array
- [x] 3.5 创建 `companion/src/core/__tests__/quantizer.test.ts`：测试最近邻（纯色映射、中间色映射）、Floyd-Steinberg（纯色不变、灰色抖动）、饱和度增强（factor=1 不变、灰色不受影响）

## 4. 物理缓冲区编码

- [x] 4.1 创建 `companion/src/core/buffer-encoder.ts`：实现 `encodeToPhysicalBuffer(indices: Uint8Array, logicalW: number, logicalH: number): Uint8Array`，执行 rotation=3 坐标变换 `(lx,ly)→(ly, 479-lx)` + 4-bit 打包，输出 192,000 字节
- [x] 4.2 创建 `companion/src/core/__tests__/buffer-encoder.test.ts`：测试输出长度 192000、单像素坐标变换正确、全白 0x11 填充、全黑 0x00 填充、混合像素打包正确

## 5. 集成验证

- [x] 5.1 运行 `npm run test` 确认所有单元测试通过
- [x] 5.2 运行 `npm run build` 确认 TypeScript 编译无错误
