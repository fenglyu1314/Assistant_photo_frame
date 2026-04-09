## ADDED Requirements

### Requirement: Electron 应用启动

系统必须使用 Electron 28+ 作为运行时，通过 electron-vite 构建工具管理主进程和渲染进程。应用启动后必须创建主窗口并加载 Vue 3 渲染进程页面。

#### Scenario: 正常启动

- **WHEN** 用户执行 `npm run dev` 或启动打包后的应用
- **THEN** Electron 主进程启动，创建一个 BrowserWindow 主窗口，加载 Vue 3 渲染进程页面，窗口可见

#### Scenario: 窗口默认尺寸

- **WHEN** 主窗口创建
- **THEN** 窗口尺寸必须至少为 900×700，居中显示

### Requirement: preload IPC 桥接

系统必须通过 preload 脚本使用 `contextBridge.exposeInMainWorld` 暴露安全的 IPC API，渲染进程不能直接访问 Node.js API。

#### Scenario: 渲染进程调用主进程

- **WHEN** 渲染进程需要与主进程通信
- **THEN** 必须通过 preload 暴露的 `window.api` 对象调用，使用 `ipcRenderer.invoke` / `ipcRenderer.send` 模式

#### Scenario: contextIsolation 启用

- **WHEN** BrowserWindow 创建
- **THEN** `webPreferences.contextIsolation` 必须为 `true`，`nodeIntegration` 必须为 `false`

### Requirement: 系统托盘

系统必须在应用启动时创建系统托盘图标，提供后台常驻能力。

#### Scenario: 托盘图标创建

- **WHEN** 应用启动完成
- **THEN** 系统托盘区域必须显示应用图标

#### Scenario: 关闭窗口隐藏而非退出

- **WHEN** 用户点击主窗口的关闭按钮
- **THEN** 主窗口必须隐藏（`mainWindow.hide()`），应用继续在托盘运行，不退出进程

#### Scenario: 托盘右键菜单

- **WHEN** 用户右键点击托盘图标
- **THEN** 必须显示上下文菜单，包含至少"打开主窗口"和"退出"两个选项

#### Scenario: 双击托盘恢复窗口

- **WHEN** 用户双击托盘图标
- **THEN** 如果主窗口已隐藏则显示并聚焦，如果已显示则聚焦

#### Scenario: 托盘退出

- **WHEN** 用户点击托盘菜单的"退出"
- **THEN** 应用必须调用 `app.quit()` 完全退出，释放所有资源

### Requirement: 开机自启

系统必须支持开机自启功能，在打包模式下自启后进入托盘常驻模式。

#### Scenario: 打包模式开机自启

- **WHEN** 应用以打包模式运行且用户启用了开机自启
- **THEN** 系统必须调用 `app.setLoginItemSettings({ openAtLogin: true })` 注册开机启动项

#### Scenario: 开发模式跳过自启

- **WHEN** 应用以开发模式运行（`app.isPackaged === false`）
- **THEN** 系统必须跳过开机自启设置，不注册启动项

### Requirement: 自动更新

系统必须集成 electron-updater，支持从 GitHub Releases 检测和下载更新。

#### Scenario: 启动时检测更新

- **WHEN** 应用以打包模式启动
- **THEN** 系统必须调用 `autoUpdater.checkForUpdates()` 检测是否有新版本

#### Scenario: 开发模式跳过更新

- **WHEN** 应用以开发模式运行（`app.isPackaged === false`）
- **THEN** 系统必须跳过更新检测

#### Scenario: 更新下载策略

- **WHEN** 检测到新版本可用
- **THEN** 系统不自动下载（`autoDownload: false`），仅记录日志；退出时自动安装已下载的更新（`autoInstallOnAppQuit: true`）

### Requirement: 项目构建配置

系统必须提供完整的 electron-vite 构建配置，支持开发模式和生产构建。

#### Scenario: 开发模式

- **WHEN** 执行 `npm run dev`
- **THEN** electron-vite 启动开发服务器，支持 HMR 热更新，Electron 窗口加载开发服务器 URL

#### Scenario: 生产构建

- **WHEN** 执行 `npm run build`
- **THEN** electron-vite 编译主进程、preload、渲染进程到 `out/` 目录，无 TypeScript 或构建错误

### Requirement: Tailwind CSS 集成

渲染进程必须集成 Tailwind CSS，支持实用工具类样式开发。

#### Scenario: Tailwind 样式生效

- **WHEN** 渲染进程 Vue 组件使用 Tailwind CSS 类名
- **THEN** 对应的 CSS 样式必须正确应用，在开发模式和生产构建中均有效
