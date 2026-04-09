import { contextBridge, ipcRenderer } from 'electron'

// Task 2.2: 使用 contextBridge 暴露安全的 IPC 通信接口
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
    ipcRenderer.on(channel, (_event, ...args) => callback(...args))
  }
})
