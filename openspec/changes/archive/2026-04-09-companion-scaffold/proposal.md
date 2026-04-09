## Why

固件侧（Phase 1-2）已完成，ESP32 能接收二进制帧缓冲区并刷屏。现在需要搭建 PC 端 Electron 桌面应用的基础框架，为后续的量化引擎（Phase 4）、串口通信（Phase 5）、渲染管线（Phase 6）和 UI（Phase 7）提供运行载体。本阶段聚焦应用骨架，不涉及业务功能。

## What Changes

- 新增 `companion/` 目录，初始化 electron-vite 项目（TypeScript + Vue 3 + Tailwind CSS）
- 新增主进程入口 `electron/main.ts`：窗口创建、生命周期管理
- 新增 `electron/preload.ts`：contextBridge IPC 桥接
- 新增系统托盘：关闭窗口 → 隐藏（不退出），托盘右键菜单（打开/退出），双击恢复窗口
- 新增开机自启功能（`app.setLoginItemSettings`）
- 新增自动更新模块（electron-updater，检测 GitHub Releases）
- 新增最小渲染进程 UI：`src/App.vue` + `src/main.ts` 占位页面

## Capabilities

### New Capabilities

- `electron-app-shell`: Electron 应用框架能力——主进程/渲染进程架构、窗口管理、preload IPC 桥接、系统托盘常驻、开机自启、自动更新（electron-updater）

### Modified Capabilities

（无——本阶段不涉及固件或协议变更）

## Impact

- **新增目录**: `companion/` 整个目录（~15 个文件），包括项目配置、主进程、渲染进程、构建配置
- **影响模块**: 仅 companion，不涉及 firmware
- **协议变更**: 无
- **新增依赖**: electron 28+、electron-vite、vue 3、tailwindcss、electron-updater、electron-builder
- **构建产物**: 可启动的 Electron 开发模式窗口（`npm run dev`）
