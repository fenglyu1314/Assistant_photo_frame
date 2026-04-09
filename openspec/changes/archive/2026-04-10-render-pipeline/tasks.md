## 1. 配置持久化与依赖

- [x] 1.1 安装 `electron-store` 依赖：`cd companion && npm install electron-store`
- [x] 1.2 创建 `electron/data/config-store.ts`：定义 AppConfig 接口和 schema 默认值，导出 ConfigStore 单例（包含 todos、events、weather config、refresh interval）
- [x] 1.3 配置 electron-vite 主进程构建：确保 `src/core/` 模块可被主进程 import（添加路径别名或调整导入路径）

## 2. 数据管理层

- [x] 2.1 创建 `electron/data/data-manager.ts`：实现 DataManager 类，包含待办 CRUD（addTodo / toggleTodo / removeTodo / getTodos）和日程 CRUD（addEvent / removeEvent / getUpcomingEvents），数据读写通过 ConfigStore
- [x] 2.2 创建 `electron/data/weather-api.ts`：封装 QWeather API（getCurrent + getForecast），使用 Node.js 原生 fetch，10 秒超时，解析温度/天气文本/图标
- [x] 2.3 实现 `DataManager.collect()` 方法：聚合 todos + events + weather + dateTime 为 DashboardData 对象，天气获取失败时降级为 null

## 3. EPD CSS 设计系统与模板

- [x] 3.1 创建 `companion/templates/epd-design-system.css`：定义六色 CSS 变量 + 辅助抖动色变量 + 禁用抗锯齿 + 字体栈 + image-rendering: pixelated + 基础排版 token
- [x] 3.2 创建 `companion/templates/dashboard.html`：480×800 仪表盘模板，包含日期时间区、天气区、待办列表、日程列表；引用 epd-design-system.css；内嵌 JS 从 URL query 解析 data 参数并渲染
- [x] 3.3 模板空数据状态处理：当 todos/events 为空时显示占位提示，weather 为 null 时显示"天气未配置"

## 4. 离屏渲染器

- [x] 4.1 创建 `electron/renderer/offscreen.ts`：实现 OffscreenRenderer 类，创建隐藏 BrowserWindow (480×800, offscreen, deviceScaleFactor=1)，加载模板并等待 did-finish-load + 100ms 延迟
- [x] 4.2 实现数据注入：将 DashboardData 通过 URL query `data` 参数传入模板
- [x] 4.3 实现截屏：capturePage() → NativeImage → toBitmap() → RGBA Uint8Array，验证尺寸 480×800，渲染后销毁窗口
- [x] 4.4 超时保护：10 秒渲染超时，超时时销毁窗口并返回错误

## 5. 渲染管线编排

- [x] 5.1 创建 `electron/pipeline/render-pipeline.ts`：实现 RenderPipeline 类，构造函数接收 DataManager + OffscreenRenderer + SerialManager 依赖
- [x] 5.2 实现 `execute()` 方法：按顺序执行 collect → render → enhanceSaturation → quantizeFloydSteinberg → encodeToPhysicalBuffer → sendFrameBuffer，每阶段通过事件报告进度
- [x] 5.3 并发保护：running 标志位防止重复执行
- [x] 5.4 错误处理：每阶段 try-catch，返回 `{ success, error, durationMs }`

## 6. IPC 通道注册

- [x] 6.1 在 `electron/main.ts` 中初始化 ConfigStore、DataManager、OffscreenRenderer、RenderPipeline
- [x] 6.2 注册数据管理 IPC 通道：`data:get-todos`、`data:add-todo`、`data:toggle-todo`、`data:remove-todo`、`data:get-events`、`data:add-event`、`data:remove-event`、`config:get`、`config:set`
- [x] 6.3 注册管线 IPC 通道：`pipeline:execute`、`pipeline:status`，管线进度通过 `pipeline:stage-progress` 推送到渲染进程
- [x] 6.4 参数验证：所有新 IPC handler 对缺失/非法参数返回错误，不崩溃

## 7. 构建验证

- [x] 7.1 `npm run build` 编译通过，无 TypeScript 错误
- [x] 7.2 `npm run test` 现有 89 个测试全部通过（量化/编码/协议/解析器）
- [x] 7.3 手动验证：启动 dev 模式，通过 DevTools 控制台调用 `window.api.invoke('pipeline:execute')` 触发完整管线，确认 ESP32 墨水屏显示仪表盘（⚠️ 用户手动执行）
