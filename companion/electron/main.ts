import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { SerialManager, type TransferProgress } from './serial/serial-manager'
import { ConfigStore } from './data/config-store'
import { DataManager } from './data/data-manager'
import { WeatherApi } from './data/weather-api'
import { OffscreenRenderer } from './renderer/offscreen'
import { RenderPipeline, type StageProgress } from './pipeline/render-pipeline'
import { type QuantizationParams } from '@core/quantization-params'

// Global error handlers — prevent uncaught errors from crashing the app
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason)
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let serialManager: SerialManager | null = null
let dataManager: DataManager | null = null
let offscreenRenderer: OffscreenRenderer | null = null
let renderPipeline: RenderPipeline | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    center: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Task 2.3: 拦截关闭事件 — 隐藏窗口而非退出应用
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // 加载渲染进程页面
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showWindow(): void {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  }
}

// Task 3.1-3.3: 创建系统托盘
function createTray(): void {
  // 使用默认占位图标（16x16 透明 PNG）
  const iconPath = join(__dirname, '../../resources/icon.png')
  let trayIcon: Electron.NativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) {
      trayIcon = createDefaultIcon()
    }
  } catch {
    trayIcon = createDefaultIcon()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('Assistant Photo Frame')

  // Task 3.2: 托盘右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: showWindow
    },
    { type: 'separator' },
    {
      label: '退出',
      click: (): void => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)

  // Task 3.3: 双击托盘恢复窗口
  tray.on('double-click', showWindow)
}

function createDefaultIcon(): Electron.NativeImage {
  // 创建一个简单的 16x16 彩色图标作为占位
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4T2NkYPj/n4EBBBgZGRkZQGwMwIgqCFIDEmBENQBZDVYDYGpwGoBsNcwFKM7A6QUMFxB0AUgzTi+AXIBVDQ4vAABNRiARTgp6igAAAABJRU5ErkJggg=='
  )
}

// Task 4.2-4.3: 自动更新配置
function setupAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('[AutoUpdater] Skipping update check in development mode')
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] No update available')
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message)
  })

  autoUpdater.checkForUpdates()
}

// Phase 5: 串口 IPC 桥接
function setupSerialIPC(): void {
  serialManager = new SerialManager()

  // --- Request/Response handlers (ipcMain.handle) ---

  ipcMain.handle('serial:scan', async () => {
    return serialManager!.scan()
  })

  ipcMain.handle('serial:connect', async (_event, args: { path: string }) => {
    if (!args?.path) {
      return { success: false, error: 'Missing port path' }
    }
    return serialManager!.connect(args.path)
  })

  ipcMain.handle('serial:disconnect', async () => {
    return serialManager!.disconnect()
  })

  ipcMain.handle('serial:send-buffer', async (_event, args: { buffer: Uint8Array }) => {
    if (!args?.buffer) {
      return { success: false, error: 'Missing buffer data' }
    }
    return serialManager!.sendFrameBuffer(
      args.buffer,
      (progress: TransferProgress) => {
        // Forward progress to renderer
        mainWindow?.webContents.send('serial:transfer-progress', progress)
      }
    )
  })

  ipcMain.handle('serial:ping', async () => {
    return serialManager!.ping()
  })

  ipcMain.handle('serial:status', async () => {
    return serialManager!.getStatus()
  })

  // --- Event forwarding (main → renderer push) ---

  serialManager.on('state-changed', (state) => {
    mainWindow?.webContents.send('serial:state-changed', state)
    console.log('[SerialManager] State changed:', state)
  })
}

// Phase 6: 数据管理 + 渲染管线初始化
async function setupDataAndPipeline(): Promise<void> {
  // Initialize config store (async, loads electron-store ESM module)
  await ConfigStore.init()

  // Initialize DataManager
  dataManager = new DataManager()

  // Initialize OffscreenRenderer
  offscreenRenderer = new OffscreenRenderer()

  // Initialize RenderPipeline
  renderPipeline = new RenderPipeline(dataManager, offscreenRenderer, serialManager!)

  // Forward pipeline stage progress to renderer
  renderPipeline.on('stage-progress', (progress: StageProgress) => {
    mainWindow?.webContents.send('pipeline:stage-progress', progress)
  })

  renderPipeline.on('transfer-progress', (progress: TransferProgress) => {
    mainWindow?.webContents.send('serial:transfer-progress', progress)
  })
}

// Phase 6: 数据管理 IPC 通道
function setupDataIPC(): void {
  // --- Todo CRUD ---

  ipcMain.handle('data:get-todos', async () => {
    return dataManager!.getTodos()
  })

  ipcMain.handle('data:add-todo', async (_event, args: { text?: string }) => {
    if (!args?.text || typeof args.text !== 'string' || args.text.trim() === '') {
      return { success: false, error: 'Missing or empty text' }
    }
    return dataManager!.addTodo(args.text.trim())
  })

  ipcMain.handle('data:toggle-todo', async (_event, args: { id?: string }) => {
    if (!args?.id || typeof args.id !== 'string') {
      return { success: false, error: 'Missing or invalid id' }
    }
    const result = await dataManager!.toggleTodo(args.id)
    if (!result) {
      return { success: false, error: 'Todo not found' }
    }
    return result
  })

  ipcMain.handle('data:remove-todo', async (_event, args: { id?: string }) => {
    if (!args?.id || typeof args.id !== 'string') {
      return { success: false, error: 'Missing or invalid id' }
    }
    const removed = await dataManager!.removeTodo(args.id)
    if (!removed) {
      return { success: false, error: 'Todo not found' }
    }
    return { success: true }
  })

  // --- Event CRUD ---

  ipcMain.handle('data:get-events', async () => {
    return dataManager!.getUpcomingEvents()
  })

  ipcMain.handle('data:add-event', async (_event, args: { title?: string; date?: string; time?: string }) => {
    if (!args?.title || typeof args.title !== 'string' || args.title.trim() === '') {
      return { success: false, error: 'Missing or empty title' }
    }
    if (!args?.date || typeof args.date !== 'string') {
      return { success: false, error: 'Missing or invalid date' }
    }
    return dataManager!.addEvent(args.title.trim(), args.date, args.time)
  })

  ipcMain.handle('data:remove-event', async (_event, args: { id?: string }) => {
    if (!args?.id || typeof args.id !== 'string') {
      return { success: false, error: 'Missing or invalid id' }
    }
    const removed = await dataManager!.removeEvent(args.id)
    if (!removed) {
      return { success: false, error: 'Event not found' }
    }
    return { success: true }
  })

  // --- Config ---

  ipcMain.handle('config:get', async (_event, args: { key?: string }) => {
    if (!args?.key || typeof args.key !== 'string') {
      return { success: false, error: 'Missing or invalid key' }
    }
    const store = await ConfigStore.getStore()
    return store.get(args.key)
  })

  ipcMain.handle('config:set', async (_event, args: { key?: string; value?: unknown }) => {
    if (!args?.key || typeof args.key !== 'string') {
      return { success: false, error: 'Missing or invalid key' }
    }
    const store = await ConfigStore.getStore()
    store.set(args.key, args.value)

    // Task 4.2: If refresh interval changed, restart timer
    if (args.key === 'refresh' && args.value && typeof args.value === 'object') {
      const refreshConfig = args.value as { intervalMinutes?: number }
      if (refreshConfig.intervalMinutes && refreshTimer) {
        startRefreshTimer(refreshConfig.intervalMinutes)
      }
    }

    return { success: true }
  })

  // --- City Search (GeoAPI) ---

  ipcMain.handle('weather:search-city', async (_event, args: { query?: string }) => {
    if (!args?.query || typeof args.query !== 'string' || args.query.trim() === '') {
      return { success: false, error: 'Missing or empty query', results: [] }
    }
    try {
      const weatherConfig = await ConfigStore.get('weather')
      if (!weatherConfig.apiKey || !weatherConfig.apiHost) {
        return { success: false, error: '请先配置 API Key 和 API Host', results: [] }
      }
      const results = await WeatherApi.searchCity(
        args.query.trim(),
        weatherConfig.apiKey,
        weatherConfig.apiHost
      )
      return { success: true, results }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg, results: [] }
    }
  })
}

// Phase 6+8: 渲染管线 IPC 通道
function setupPipelineIPC(): void {
  ipcMain.handle('pipeline:execute', async () => {
    if (!renderPipeline) {
      return { success: false, error: 'Pipeline not initialized' }
    }
    return renderPipeline.execute()
  })

  ipcMain.handle('pipeline:status', async () => {
    if (!renderPipeline) {
      return { running: false, hasCache: false }
    }
    return renderPipeline.getStatus()
  })

  // Phase 8: 独立预览渲染通道
  ipcMain.handle('pipeline:render-preview', async () => {
    if (!renderPipeline) {
      return { success: false, error: 'Pipeline not initialized' }
    }
    return renderPipeline.renderPreview()
  })

  // Phase 8: 独立设备同步通道
  ipcMain.handle('pipeline:sync-device', async () => {
    if (!renderPipeline) {
      return { success: false, error: 'Pipeline not initialized' }
    }
    return renderPipeline.syncToDevice()
  })

  // Phase 10: 快速重量化通道
  ipcMain.handle('pipeline:requantize', async (_event, args: { params: QuantizationParams }) => {
    if (!renderPipeline) {
      return { success: false, error: 'Pipeline not initialized' }
    }
    if (!args?.params) {
      return { success: false, error: 'Missing quantization params' }
    }
    return renderPipeline.requantize(args.params)
  })
}

// Phase 7: 定时刷新管理器
let refreshTimer: ReturnType<typeof setInterval> | null = null

function startRefreshTimer(intervalMinutes: number): void {
  stopRefreshTimer()
  const intervalMs = intervalMinutes * 60 * 1000
  console.log(`[RefreshTimer] Starting with interval: ${intervalMinutes} minutes`)
  refreshTimer = setInterval(async () => {
    if (!renderPipeline) return
    console.log('[RefreshTimer] Executing scheduled pipeline...')
    const result = await renderPipeline.execute()
    if (!result.success) {
      console.warn('[RefreshTimer] Pipeline failed:', result.error)
    } else {
      console.log(`[RefreshTimer] Pipeline completed in ${result.durationMs}ms`)
    }
  }, intervalMs)
}

function stopRefreshTimer(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
    console.log('[RefreshTimer] Stopped')
  }
}

function setupScheduledRefresh(): void {
  // Listen to serial state changes to start/stop timer
  serialManager!.on('state-changed', async (state: { connected: boolean }) => {
    if (state.connected) {
      // Device connected: only start periodic timer.
      // User should manually click "刷新预览" → "同步到墨水屏" for the first refresh.
      console.log('[RefreshTimer] Device connected, starting periodic timer...')
      try {
        const config = await ConfigStore.get('refresh')
        startRefreshTimer(config.intervalMinutes)
      } catch (err) {
        console.error('[RefreshTimer] Failed to start timer:', err)
      }
    } else {
      // Device disconnected: stop timer
      stopRefreshTimer()
    }
  })
}

// 应用启动
app.whenReady().then(async () => {
  createWindow()
  createTray()

  // Phase 5: 初始化串口通信
  setupSerialIPC()

  // Phase 6: 初始化数据管理 + 渲染管线
  await setupDataAndPipeline()
  setupDataIPC()
  setupPipelineIPC()

  // Phase 7: 定时刷新
  setupScheduledRefresh()

  // Task 4.1: 开机自启（仅打包模式）
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true })
  }

  // Task 4.2-4.3: 自动更新
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 确保 before-quit 设置 isQuitting 标志
app.on('before-quit', () => {
  isQuitting = true
  // 停止定时刷新
  stopRefreshTimer()
  // 清理串口资源
  serialManager?.destroy()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
