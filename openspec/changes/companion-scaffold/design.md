## Context

Phase 1-2 已完成 ESP32 固件侧：EPD 驱动 + 二进制帧协议。ESP32 能接收 192KB 帧缓冲区并刷屏。

现在需要搭建 PC 端 Electron 桌面应用的基础框架。本阶段只关注"应用壳"：能启动、显示窗口、最小化到托盘、开机自启、自动更新。不涉及串口、量化、渲染等业务功能。

参考项目 `Reference/ESP32-S3-PhotoPainter/` 中有一个 `epd-companion/` 目录，包含类似的 Electron 项目结构，但该目录在当前工作区中不可直接访问（submodule 未展开或目录为空）。因此本阶段采用**全新初始化**策略，使用 `create-electron-vite` 脚手架创建项目，再按设计文档的目录结构调整。

## Goals / Non-Goals

**Goals:**
- 创建 `companion/` 目录，包含完整的 electron-vite + Vue 3 + TypeScript 项目结构
- 主进程：窗口创建 + 生命周期管理 + preload IPC 桥接
- 系统托盘：关闭窗口隐藏而非退出，托盘图标+右键菜单，双击恢复
- 开机自启：`app.setLoginItemSettings` 静默启动
- 自动更新：electron-updater 对接 GitHub Releases
- 开发模式可运行：`npm run dev` 启动开发窗口

**Non-Goals:**
- 不实现串口通信模块（Phase 5）
- 不实现量化引擎（Phase 4）
- 不实现离屏渲染管线（Phase 6）
- 不实现数据管理/天气 API（Phase 6）
- 不实现完整 UI 组件（Phase 7）
- 不实现 electron-builder 打包配置（Phase 7）
- 不配置 CI/CD 流水线

## Decisions

### D1: 项目初始化方式 — 全新 create-electron-vite

**选择**: 使用 `npm create electron-vite@latest` 脚手架初始化，模板选 Vue + TypeScript。

**理由**:
- 参考项目的 `epd-companion/` 目录在当前工作区不可直接访问
- electron-vite 脚手架生成标准且经过验证的项目结构
- 减少手动配置错误风险

**否决方案**:
- 手动从零搭建：配置复杂（vite config、tsconfig、electron-builder 集成），容易遗漏

### D2: 进程架构 — 标准 Electron 三层

```
main.ts (主进程)
  ├── 窗口管理 (BrowserWindow)
  ├── 系统托盘 (Tray)
  ├── 开机自启 (app.setLoginItemSettings)
  └── 自动更新 (electron-updater)

preload.ts (preload 脚本)
  └── contextBridge 暴露安全 IPC API

src/ (渲染进程 Vue 3)
  ├── main.ts (Vue 入口)
  └── App.vue (占位页面)
```

### D3: 窗口生命周期 — 关闭即隐藏

**选择**: 拦截主窗口 `close` 事件，调用 `mainWindow.hide()` 而非 `app.quit()`。仅通过托盘"退出"菜单或 `app.quit()` 才真正退出。

**理由**: 桌面助手需要后台常驻，定时刷新墨水屏（后续 Phase 实现）。

### D4: 托盘实现

- 托盘图标：使用项目图标（初始用 electron 默认图标占位，Phase 7 替换）
- 右键菜单项：打开主窗口 / 退出
- 双击托盘图标：恢复/显示主窗口
- Windows 下使用 `nativeImage.createFromPath()` 加载 .ico/.png 图标

### D5: 自动更新策略

**选择**: 使用 `electron-updater`，对接 GitHub Releases。

**配置**:
- `autoDownload: false`：不自动下载，仅检测
- `autoInstallOnAppQuit: true`：退出时自动安装
- 开发模式跳过更新检测（`app.isPackaged` 判断）

### D6: 目录结构

```
companion/
├── electron/                # 主进程
│   ├── main.ts              # 入口：窗口 + 托盘 + 自启 + 更新
│   └── preload.ts           # contextBridge IPC
├── src/                     # 渲染进程 (Vue 3)
│   ├── App.vue              # 占位页面
│   ├── main.ts              # Vue 入口
│   └── env.d.ts             # 类型声明
├── resources/               # 应用图标等
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
└── index.html
```

## Risks / Trade-offs

### R1: electron-vite 脚手架版本兼容
- **风险**: 脚手架生成的模板可能与最新 Electron 或 Vue 版本不兼容
- **缓解**: 使用最新稳定版 electron-vite，生成后立即验证 `npm run dev` 可启动

### R2: node-serialport 原生模块兼容性（预留）
- **风险**: Phase 5 添加 serialport 时可能与 Electron 版本不兼容
- **缓解**: 本阶段不安装 serialport，但选择 Electron 28+ 确保后续兼容；在 electron.vite.config.ts 中预留 externals 配置

### R3: 开机自启在开发模式无效
- **风险**: `app.setLoginItemSettings` 在未打包模式下行为不同
- **缓解**: 仅在 `app.isPackaged` 时启用开机自启；开发模式下跳过
