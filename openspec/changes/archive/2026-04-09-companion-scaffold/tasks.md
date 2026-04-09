## 1. 项目初始化

- [x] 1.1 使用 `npm create electron-vite@latest` 初始化 `companion/` 目录（模板：Vue + TypeScript），安装依赖（`npm install`）
- [x] 1.2 安装 Tailwind CSS：`npm install -D tailwindcss @tailwindcss/vite`，创建 `tailwind.config.ts` 和 `postcss.config.js`，在渲染进程入口引入 Tailwind 样式
- [x] 1.3 验证开发模式可启动：`npm run dev` 显示默认 Vue 页面（用户手动执行验证）

## 2. 主进程 + 窗口管理

- [x] 2.1 重写 `electron/main.ts`：创建 BrowserWindow（900×700，居中），配置 `contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`，加载 preload 脚本
- [x] 2.2 编写 `electron/preload.ts`：使用 `contextBridge.exposeInMainWorld('api', { ... })` 暴露 IPC 通信接口（`invoke`、`send`、`on`）
- [x] 2.3 拦截主窗口 `close` 事件：调用 `event.preventDefault()` + `mainWindow.hide()`，阻止窗口关闭退出应用

## 3. 系统托盘

- [x] 3.1 在 `electron/main.ts` 中创建 `Tray` 实例：加载图标（初始用内置默认图标或 resources/ 下的占位图标），设置 tooltip
- [x] 3.2 实现托盘右键菜单：`Menu.buildFromTemplate([{ label: '打开主窗口', click: showWindow }, { type: 'separator' }, { label: '退出', click: app.quit }])`
- [x] 3.3 监听托盘 `double-click` 事件：调用 `mainWindow.show()` + `mainWindow.focus()` 恢复窗口

## 4. 开机自启 + 自动更新

- [x] 4.1 在 `app.whenReady()` 中添加开机自启逻辑：仅 `app.isPackaged` 时调用 `app.setLoginItemSettings({ openAtLogin: true })`
- [x] 4.2 安装 `electron-updater`（`npm install electron-updater`），在主进程中配置：`autoDownload: false`、`autoInstallOnAppQuit: true`；仅 `app.isPackaged` 时调用 `autoUpdater.checkForUpdates()`
- [x] 4.3 添加更新事件日志：监听 `update-available`、`update-not-available`、`error` 事件，输出到 console.log

## 5. 渲染进程占位 UI

- [x] 5.1 重写 `src/App.vue`：使用 Tailwind CSS 创建简单的占位页面，显示应用名称 "Assistant Photo Frame"、版本号、连接状态占位
- [x] 5.2 确保 `src/main.ts` 正确挂载 Vue 应用，引入 Tailwind CSS 全局样式

## 6. 构建验证

- [x] 6.1 执行 `npm run build` 确认生产构建无报错（用户手动执行）
- [x] 6.2 执行 `npm run dev` 验证完整功能：窗口显示、关闭隐藏到托盘、托盘菜单可用、双击恢复（用户手动执行）
