## Context

Phase 1-5 构建了完整的底层基础设施：
- **固件侧**：EPaperDriver 刷屏 + BinaryProtocol 接收状态机 + 分块传输确认
- **桌面侧**：Electron 骨架（窗口/托盘/自动更新） + 量化引擎 (palette/quantizer/buffer-encoder) + 串口通信栈 (binary-protocol/response-parser/serial-manager) + IPC 桥接

当前缺失的环节是**内容生成**：没有任何代码负责产生要显示在墨水屏上的画面。本设计补全从"数据采集 → HTML 渲染 → 截屏 → 量化 → 编码 → 发送"的完整管线。

**约束条件**：
- 离屏渲染窗口尺寸必须精确 480×800（逻辑分辨率，竖屏 rotation=3）
- 量化引擎和帧编码器在渲染进程 (`src/core/`) 已实现，管线在主进程调用时需要**在主进程复刻或通过 IPC 中转**
- ESP32 固件无需任何改动，协议层不变
- electron-store 是唯一新增运行时依赖

## Goals / Non-Goals

**Goals:**
- 实现离屏 BrowserWindow 渲染管理，能加载 HTML 模板并截屏为 RGBA 像素
- 创建墨水屏专用 CSS 设计系统，让 HTML 模板的输出在六色量化后视觉最优
- 制作一个可用的仪表盘 HTML 模板（日期时间 + 待办 + 日程 + 天气）
- 实现数据管理层（待办/日程 CRUD + 天气 API 调用 + 配置持久化）
- 将所有环节串联为一键触发的渲染管线
- 所有新功能通过 IPC 通道暴露给渲染进程

**Non-Goals:**
- 不实现用户 UI（Vue 组件、编辑器等 — 属于 Phase 7）
- 不实现定时后台刷新调度（Phase 7）
- 不支持多模板切换（未来扩展）
- 不改动固件或协议

## Decisions

### D1: 量化/编码在主进程执行

**选择**：将量化和编码逻辑在主进程中直接调用（通过 import 共享模块）

**理由**：
- `src/core/` 的量化和编码模块是纯 TypeScript 函数，不依赖 DOM/Browser API
- 管线完整流程（截屏→量化→编码→串口发送）全部在主进程完成，避免 IPC 来回传输 192KB 数据
- electron-vite 配置中主进程可以通过路径别名导入 `src/core/` 模块

**否决方案**：
- 通过 IPC 把 RGBA 数据发到渲染进程量化再发回 — 多余的 IPC 开销，480×800×4=1.5MB 来回传输
- 在离屏窗口内执行量化 — 增加架构复杂度，离屏窗口只负责渲染

### D2: 离屏渲染采用 capturePage + 按需创建

**选择**：每次渲染时创建隐藏 BrowserWindow，加载 HTML 后 `capturePage()` 截屏，完成后销毁

**理由**：
- 参考设计文档 D5 方案：用完即销毁，不占持续资源
- `capturePage()` 返回 NativeImage，可直接获取 RGBA Buffer
- 设置 `deviceScaleFactor: 1` 确保像素精确

**配置**：
```typescript
new BrowserWindow({
  show: false,
  width: 480,
  height: 800,
  webPreferences: {
    offscreen: true,
    deviceScaleFactor: 1
  }
})
```

**否决方案**：
- html2canvas 库 — 不如 Chromium 原生截屏精确
- 长驻离屏窗口 — 浪费资源，且模板注入需要 reload 才能更新

### D3: HTML 模板数据注入方式

**选择**：通过 URL query string 传递 JSON 序列化的数据，模板内 JS 解析

**理由**：
- 简单直接，无需 preload 和 IPC
- 离屏窗口不需要 contextBridge（不与主进程交互）
- 数据量（几个 todo + events + weather）远小于 URL 长度限制

**实现**：
```typescript
const data = JSON.stringify({ todos, events, weather, dateTime })
offscreenWindow.loadFile('templates/dashboard.html', {
  query: { data: encodeURIComponent(data) }
})
```

模板内：
```javascript
const params = new URLSearchParams(location.search)
const data = JSON.parse(decodeURIComponent(params.get('data')))
```

**否决方案**：
- executeJavaScript 注入 — 时序复杂，需等 DOM ready
- 文件系统写临时 JSON — 多余的 I/O

### D4: 配置持久化使用 electron-store

**选择**：`electron-store` — 基于 JSON 文件的键值存储

**理由**：
- Electron 生态最成熟的配置方案
- 自动处理路径（`app.getPath('userData')`）
- 支持 schema 验证和默认值
- 零外部依赖（不需要数据库）

**存储内容**：
```typescript
interface AppConfig {
  weather: {
    apiKey: string
    location: string    // 城市代码
    unit: 'metric'
  }
  refresh: {
    intervalMinutes: number  // 默认 30
  }
  todos: Array<{ id: string; text: string; done: boolean }>
  events: Array<{ id: string; title: string; date: string; time?: string }>
}
```

### D5: 天气 API 选择 QWeather (和风天气)

**选择**：QWeather 免费版 API

**理由**：
- 国内可直接访问，无需翻墙
- 免费版每天 1000 次调用，个人项目绰绰有余
- 支持实时天气 + 3 天预报
- API 结构简单，JSON 响应

**接口**：
- 实时天气：`GET /v7/weather/now?location={id}&key={key}`
- 3 天预报：`GET /v7/weather/3d?location={id}&key={key}`

### D6: 管线编排为单一函数链

**选择**：`RenderPipeline` 类封装完整流程

```
renderPipeline.execute()
  1. dataManager.collect()        → DashboardData
  2. offscreen.render(data)       → NativeImage
  3. image.toBitmap()             → RGBA Buffer
  4. enhanceSaturation(rgba)      → RGBA Buffer
  5. quantizeFloydSteinberg(rgba) → indices
  6. encodeToPhysicalBuffer(idx)  → 192KB Buffer
  7. serialManager.sendFrameBuffer(buf) → TransferResult
```

**理由**：
- 线性流程，每步有清晰的输入输出
- 每步可独立测试
- 失败时能精确报告哪个阶段出错

## Risks / Trade-offs

### R1: capturePage 可能受 DPI 缩放影响
- **风险**：Windows 高 DPI 设置可能导致截图不是精确 480×800
- **缓解**：`deviceScaleFactor: 1` 强制 1:1；截图后验证尺寸，异常时报错而非发送错误数据

### R2: electron-store 文件损坏
- **风险**：进程异常退出时 JSON 文件可能损坏
- **缓解**：electron-store 内置原子写入；首次读取失败时使用默认值，不崩溃

### R3: QWeather API Key 泄露
- **风险**：API Key 存储在本地 JSON 文件中
- **缓解**：这是桌面端，Key 存在用户本机 appData 中，非代码仓库；免费 Key 无金融风险

### R4: 模板渲染到字体可能不一致
- **风险**：不同 Windows 系统可能缺少指定字体
- **缓解**：CSS 使用通用字体栈（system-ui, Arial, sans-serif），不依赖特殊字体；墨水屏低分辨率下字体差异不敏感
