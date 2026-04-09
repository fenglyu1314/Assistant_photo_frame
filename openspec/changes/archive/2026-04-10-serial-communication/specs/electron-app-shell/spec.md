## MODIFIED Requirements

### Requirement: preload IPC 桥接

系统必须通过 preload 脚本使用 `contextBridge.exposeInMainWorld` 暴露安全的 IPC API，渲染进程不能直接访问 Node.js API。暴露的 API 必须包含 `invoke`、`send`、`on`、`off` 四个方法。

#### Scenario: 渲染进程调用主进程
- **WHEN** 渲染进程需要与主进程通信
- **THEN** 必须通过 preload 暴露的 `window.api` 对象调用，使用 `ipcRenderer.invoke` / `ipcRenderer.send` 模式

#### Scenario: contextIsolation 启用
- **WHEN** BrowserWindow 创建
- **THEN** `webPreferences.contextIsolation` 必须为 `true`，`nodeIntegration` 必须为 `false`

#### Scenario: 移除事件监听器
- **WHEN** 渲染进程调用 `window.api.off(channel, callback)`
- **THEN** 必须移除指定 channel 的对应 callback 监听器，底层调用 `ipcRenderer.removeListener(channel, wrappedCallback)`

#### Scenario: Vue 组件卸载时清理
- **WHEN** Vue 组件使用 `onMounted` 注册了 `window.api.on('serial:state-changed', handler)` 并在 `onUnmounted` 调用 `window.api.off('serial:state-changed', handler)`
- **THEN** 该 handler 必须被正确移除，不会在后续事件中被调用，不产生内存泄漏
