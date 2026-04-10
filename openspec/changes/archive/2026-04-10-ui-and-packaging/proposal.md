## Why

Phase 1-6 已搭建完毕从数据收集到墨水屏刷屏的完整链路，但渲染进程仅有一个占位欢迎页面，用户无法通过 GUI 进行任何操作（连接设备、编辑待办/日程、配置天气、触发刷屏）。Phase 7 将实现完整的用户界面、定时后台刷新、以及 electron-builder 打包配置，使项目成为一个可安装可日用的桌面端。

## What Changes

- **新增 Vue 组件系统**：实现左右分栏布局 App.vue，左侧为控制面板（串口、待办、日程、天气设置），右侧为 EPD 预览
- **新增串口面板** SerialPanel.vue：扫描串口、选择设备、连接/断开、实时状态指示
- **新增待办编辑器** TodoEditor.vue：添加/删除/切换待办事项，实时同步主进程 DataManager
- **新增日程编辑器** EventEditor.vue：添加/删除日程，日期+时间选择
- **新增天气设置面板** WeatherPanel.vue：配置和风天气 API Key 和城市 ID
- **新增 EPD 预览** EpdPreview.vue：显示当前仪表盘渲染效果的缩略图，手动触发刷屏按钮，管线进度展示
- **新增定时后台刷新**：按配置间隔（默认 30 分钟）自动执行渲染管线
- **新增 electron-builder 打包配置**：NSIS 安装器，Windows 平台 `.exe` 安装包
- **不涉及协议变更**：固件侧无需任何修改

## Capabilities

### New Capabilities
- `companion-ui`: Vue 3 组件系统，包括 App.vue 分栏布局、SerialPanel、TodoEditor、EventEditor、WeatherPanel、EpdPreview 六大组件及其 IPC 通信集成
- `scheduled-refresh`: 定时后台刷新机制，按可配置间隔自动执行渲染管线
- `electron-packaging`: electron-builder 打包配置，NSIS 安装器，Windows 平台可安装 `.exe`

### Modified Capabilities
（无现有 spec 的需求级变更）

## Impact

- **影响模块**：仅 companion/ 桌面端
- **新增文件**：`src/components/*.vue`（6 个组件），主进程定时刷新逻辑
- **修改文件**：`src/App.vue`（重写为分栏布局），`electron/main.ts`（添加定时刷新），`package.json`（添加 electron-builder 配置）
- **新增依赖**：无额外 npm 依赖（Tailwind CSS + Vue 3 已存在）
- **固件**：不受影响，无需重新编译
- **协议**：不涉及变更
