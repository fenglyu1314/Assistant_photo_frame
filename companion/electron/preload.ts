import { contextBridge, ipcRenderer } from 'electron'

// Map to track wrapped callbacks for proper removal
const callbackMap = new WeakMap<(...args: unknown[]) => void, (...args: unknown[]) => void>()

// Task 2.2 + Phase 5: 使用 contextBridge 暴露安全的 IPC 通信接口
contextBridge.exposeInMainWorld('api', {
  /**
   * 调用主进程 handler（request-response 模式）
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },

  /**
   * 向主进程发送单向消息
   */
  send: (channel: string, ...args: unknown[]): void => {
    ipcRenderer.send(channel, ...args)
  },

  /**
   * 监听主进程发来的消息
   */
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    callbackMap.set(callback, wrappedCallback)
    ipcRenderer.on(channel, wrappedCallback)
  },

  /**
   * 移除指定 channel 的监听器（防止内存泄漏）
   */
  off: (channel: string, callback: (...args: unknown[]) => void): void => {
    const wrappedCallback = callbackMap.get(callback)
    if (wrappedCallback) {
      ipcRenderer.removeListener(channel, wrappedCallback)
      callbackMap.delete(callback)
    }
  }
})
