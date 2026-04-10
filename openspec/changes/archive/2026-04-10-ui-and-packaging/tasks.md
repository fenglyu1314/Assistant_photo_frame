## 1. App 布局与组件框架

- [x] 1.1 重写 `src/App.vue` 为左右分栏布局（左 40% 控制面板 + 右 60% EPD 预览），深色主题，左侧可滚动
- [x] 1.2 创建 `src/components/SerialPanel.vue` 串口面板组件（扫描设备列表、选择端口、连接/断开按钮、状态指示灯），通过 IPC 调用 `serial:scan`/`serial:connect`/`serial:disconnect`/`serial:status`，监听 `serial:state-changed` 事件

## 2. 数据编辑组件

- [x] 2.1 创建 `src/components/TodoEditor.vue` 待办编辑器组件（输入框+添加按钮、待办列表显示+勾选+删除），通过 IPC 调用 `data:get-todos`/`data:add-todo`/`data:toggle-todo`/`data:remove-todo`
- [x] 2.2 创建 `src/components/EventEditor.vue` 日程编辑器组件（标题+日期+时间输入、日程列表显示+删除），通过 IPC 调用 `data:get-events`/`data:add-event`/`data:remove-event`
- [x] 2.3 创建 `src/components/WeatherPanel.vue` 天气设置面板（API Key 输入、城市 ID 输入、保存按钮），通过 IPC 调用 `config:get`/`config:set`

## 3. EPD 预览与刷新

- [x] 3.1 创建 `src/components/EpdPreview.vue` 墨水屏预览组件（预览图展示区、手动刷新按钮、管线阶段进度条、传输进度条），通过 IPC 调用 `pipeline:execute`，监听 `pipeline:stage-progress` 和 `serial:transfer-progress` 事件
- [x] 3.2 扩展主进程 IPC：添加 `pipeline:execute` 返回预览截图（PNG base64），或新增 `pipeline:preview` 通道仅执行渲染+返回截图不发送到墨水屏

## 4. 定时后台刷新

- [x] 4.1 在 `electron/main.ts` 实现定时刷新管理器：监听串口连接状态，连接时立即执行一次管线并启动 setInterval 定时器，断开时停止定时器，间隔配置从 ConfigStore 读取
- [x] 4.2 在定时刷新间隔变更时（config:set 对 refresh.intervalMinutes 的写入）重启定时器

## 5. 打包配置

- [x] 5.1 在 `package.json` 添加 electron-builder 打包配置（build 字段）：NSIS 安装器、extraResources 包含 templates/、应用元数据（名称/版本/图标）
- [x] 5.2 添加 `build:dist` 脚本（electron-vite build + electron-builder），确认 serialport 原生模块的 rebuild 配置正确

## 6. 集成验证

- [x] 6.1 端到端联调：核心功能验证通过（串口连接、待办CRUD、日程CRUD、手动刷屏、数据同步到墨水屏）。已知问题：UI 预览图不显示，待后续修复
- [x] 6.2 验证 `npm run build` 编译通过无错误，`npm run test` 现有测试全部通过
