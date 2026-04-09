## Why

Phase 1-5 已完成"桩到桩"基础设施：固件接收帧缓冲区并刷屏、Electron 应用骨架、量化引擎、串口通信。但目前没有任何东西生成帧缓冲区的内容——App.vue 只是一个占位欢迎页，缺少从"数据 → 渲染 → 截屏 → 量化 → 编码 → 发送"的完整管线。Phase 6 的任务是把这条管线跑通，让墨水屏首次显示真实的仪表盘画面。

## What Changes

- 新增 **离屏渲染模块** (`electron/renderer/offscreen.ts`)：创建隐藏的 480×800 BrowserWindow，加载 HTML 模板，注入数据，通过 `capturePage()` 截取 RGBA 像素
- 新增 **EPD CSS 设计系统** (`companion/templates/epd-design-system.css`)：六色精确色值 CSS 变量 + 抖动友好的字体/间距规范 + 禁用抗锯齿
- 新增 **仪表盘 HTML 模板** (`companion/templates/dashboard.html`)：竖屏 480×800 布局，展示日期时间、待办事项、日程、天气
- 新增 **数据管理器** (`electron/data/data-manager.ts`)：聚合 todos、events、日期时间等数据，提供统一的数据接口供模板渲染使用
- 新增 **天气 API 封装** (`electron/data/weather-api.ts`)：和风天气 QWeather API 的 HTTP 客户端，获取实时天气和 3 日预报
- 新增 **配置持久化** (`electron/data/config-store.ts`)：使用 electron-store 保存用户配置（天气城市、API Key、刷新间隔等）
- 新增 **渲染管线集成** (`electron/pipeline/render-pipeline.ts`)：串联离屏渲染→截屏→量化→编码→发送→刷屏的完整流程，支持定时和手动触发
- 新增对应的 **IPC 通道**：暴露数据管理和渲染管线控制给渲染进程
- **不涉及协议变更**：复用现有二进制帧协议，ESP32 固件无需改动

## Capabilities

### New Capabilities
- `offscreen-renderer`: 离屏 BrowserWindow 渲染管理，加载 HTML 模板、注入数据、截屏为 RGBA 像素
- `epd-design-system`: 墨水屏专用 CSS 设计系统（六色变量、抖动色、排版规范）和 dashboard HTML 模板
- `data-manager`: 数据聚合层（待办、日程、日期时间），以及天气 API 封装和配置持久化
- `render-pipeline`: 端到端渲染管线编排（数据→渲染→截屏→量化→编码→发送→刷屏）

### Modified Capabilities
- `serial-ipc-bridge`: 新增渲染管线和数据管理相关的 IPC 通道注册

## Impact

- **companion/electron/** — 新增 `renderer/`、`data/`、`pipeline/` 三个子目录
- **companion/templates/** — 新增 HTML 模板和 CSS 设计系统目录
- **companion/electron/main.ts** — 新增离屏渲染和管线 IPC 初始化
- **companion/package.json** — 新增依赖 `electron-store`（配置持久化）
- **firmware/** — 无改动
- **companion/src/core/** — 无改动（量化/编码模块被管线复用，但不修改）
