## Requirements

### Requirement: 量化效果图生成
桌面端 SHALL 提供 `indicesToDataUrl(indices, width, height)` 函数，将量化后的 palette indices 数组还原为 480×800 的 PNG data URL，并同时计算 6 色使用统计。

#### Scenario: 正常生成量化效果图
- **WHEN** 传入有效的 `Uint8Array` indices 数组（长度 = width × height）
- **THEN** 函数 SHALL 返回 `{ dataUrl: string, colorStats: ColorStats }`，其中 `dataUrl` 为 PNG 格式的 data URL（`data:image/png;base64,...`），图片尺寸精确为 480×800

#### Scenario: Palette index 还原为 RGB
- **WHEN** 遍历 indices 数组中的每个值
- **THEN** 每个 palette index SHALL 通过 `EPD_PALETTE` 映射为对应的 RGB 颜色值（index 4 不会出现在有效的 indices 中）

#### Scenario: 色彩统计输出
- **WHEN** 量化效果图生成完成
- **THEN** `colorStats` SHALL 包含每个有效 palette index（0,1,2,3,5,6）的像素数量和百分比占比

#### Scenario: 零依赖实现
- **WHEN** 在 Electron 主进程中调用
- **THEN** SHALL 使用 Electron 内置的 `nativeImage.createFromBuffer()` 从 RGBA 数据创建图片，不引入外部图像处理库
