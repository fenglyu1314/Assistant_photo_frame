## Why

Phase 1-10 已完成完整渲染管线、预览系统和文字清晰度优化，墨水屏能正常显示仪表盘画面。但当前模板存在以下问题：

1. **时间显示无意义**：墨水屏刷新耗时 17-20 秒，显示的时间在刷屏后即过时，占据 Header 大量空间（约 60px）却无实用价值
2. **黄色和绿色未被利用**：6 色墨水屏的黄色和绿色在当前模板中几乎没有使用，浪费了硬件色彩能力
3. **灰色文字影响清晰度**：待办已完成文字（`--epd-gray`）、日程时间（`--epd-gray`）、section count（`--epd-gray`）、天气 placeholder（`--epd-gray`）、footer（`--epd-light-gray`）等都使用灰色中间色做文字颜色，FS 抖动后产生杂色，不够清晰
4. **布局空间未充分利用**：Todos 独占 flex:1，Events 没有弹性分配，内容区域空间分配不均
5. **视觉层次不够鲜明**：Section Header 只有文字图标，缺乏色块标识；已完成待办与未完成待办视觉差异不够明显

本次优化聚焦于墨水屏模板的视觉升级，充分利用 6 色、消除灰色文字、优化布局空间分配。

## What Changes

- **修改** `companion/templates/dashboard.html` — Header 去掉时间改为一行日期+星期、Footer 改为刷新时间、Section Header 改色块条、已完成待办绿色 checkbox+删除线、今日日程黄色高亮、天气纯色几何图标、Todos/Events 都 flex:1
- **修改** `companion/templates/epd-design-system.css` — 补充文字纯色化规则、新增色块条和几何图标相关 CSS 变量
- **修改** `companion/src/core/__tests__/` — 无需修改（本次不涉及量化算法变更）
- **不涉及** 固件变更
- **不涉及** 帧协议变更

## Capabilities

### 增强功能
- `epd-template-optimize`: 墨水屏模板优化 — 去掉时间、文字纯色化、充分利用黄/绿色、色块条标识、布局空间优化

## Impact

- `companion/templates/dashboard.html` — 大幅修改（Header/Footer/Section Header/Todo/Event/Weather 区域样式和结构）
- `companion/templates/epd-design-system.css` — 新增 CSS 变量和规则
- `companion/electron/data/data-manager.ts` — 可能需要新增 `lastRefreshTime` 数据字段
- `companion/electron/pipeline/render-pipeline.ts` — 可能需要传递刷新时间到模板数据
- 不涉及固件变更
- 不涉及帧协议变更
- 不涉及量化算法变更
