## Context

Phase 1-6 已完成：固件驱动、二进制协议、Electron 脚手架、量化引擎、串口通信、渲染管线。完整的数据→渲染→量化→编码→发送→刷屏链路已验证通过。

当前渲染进程只有一个占位 App.vue（深色欢迎页面），没有任何交互功能。所有 IPC 通道已在主进程定义完毕（serial:*, data:*, config:*, pipeline:*），但渲染进程尚未调用任何通道。

本阶段需要将占位页面替换为完整的功能 UI，并添加定时刷新和打包配置。

## Goals / Non-Goals

**Goals:**
- 实现完整的 Vue 3 组件系统，用户可通过 GUI 完成所有操作
- 实现左右分栏布局：左侧控制面板，右侧 EPD 预览
- 所有组件通过 `window.api` 桥接调用已有 IPC 通道
- 定时后台刷新（可配置间隔，默认 30 分钟）
- electron-builder 打包为 Windows NSIS 安装包
- 深色主题 UI，现代美观

**Non-Goals:**
- 不实现 macOS / Linux 打包（仅 Windows）
- 不添加 Vue Router 或 Pinia（组件间通过 props/events 通信，应用复杂度不需要状态管理库）
- 不实现用户认证或云同步
- 不修改固件代码或通信协议
- 不实现模板编辑器（使用固定的 dashboard.html 模板）

## Decisions

### D1: 组件架构 — 单层组件 + 直接 IPC

**选择**：各组件直接通过 `window.api.invoke()` 调用 IPC，不引入 Pinia 状态管理。

**理由**：应用只有一个页面、六个组件，数据流简单（各组件独立管理自己的 CRUD）。引入 Pinia 增加复杂度但无明显收益。如果未来功能增长再考虑迁移。

**替代方案**：Pinia store 集中管理 → 目前过度工程。

### D2: 布局方案 — 左右分栏 (40/60)

**选择**：App.vue 使用 Tailwind CSS flex 布局，左侧 40% 控制面板（纵向滚动），右侧 60% 固定 EPD 预览区。

**理由**：窗口 900×700，左侧面板需要容纳串口、待办、日程、天气四个区域（内容较多需要滚动），右侧预览需要尽量大的空间展示 480×800 的缩略图。

### D3: EPD 预览实现 — Canvas 缩放渲染

**选择**：EpdPreview 组件请求管线执行后，主进程将离屏渲染的截图（480×800 PNG）通过 IPC 返回，组件用 `<img>` 标签以 `object-fit: contain` 展示。

**理由**：直接复用 OffscreenRenderer 的 capturePage 结果，避免在渲染进程重复渲染。PNG 编码约 200KB，IPC 传输开销可接受。

**替代方案**：在渲染进程内嵌 iframe 加载 dashboard.html → 会有 CSP 限制和数据注入复杂性。

### D4: 定时刷新 — 主进程 setInterval

**选择**：在 `electron/main.ts` 中使用 `setInterval` 按配置间隔调用 `renderPipeline.execute()`，仅在设备已连接时执行。

**理由**：主进程是渲染管线的所有者，直接调用最简洁。不需要渲染进程参与。

### D5: 打包方案 — electron-builder + NSIS

**选择**：electron-builder 配置 NSIS 安装器，打包为单一 `.exe` 安装文件。

**理由**：electron-builder 是 Electron 打包的事实标准，NSIS 是 Windows 上用户体验最好的安装方式。package.json 已包含 electron-builder 依赖。

## Risks / Trade-offs

- **[风险] IPC 数据量**：EPD 预览传输 PNG 截图 ~200KB → 可接受，每次刷新间隔至少 30 分钟
- **[风险] 定时刷新与手动刷新冲突** → RenderPipeline 已有 `this.running` 并发保护，冲突时返回 "Pipeline already running"
- **[权衡] 无 Pinia**：组件间状态共享需要通过 props/events → 当前组件少，可接受。未来如需扩展考虑迁移
- **[权衡] 仅 Windows 打包**：macOS/Linux 用户暂无安装包 → 目标用户场景为 Windows 桌面
- **[风险] serialport 原生模块打包** → electron-builder + electron-rebuild 已配置在 package.json，postinstall 脚本调用 electron-rebuild
