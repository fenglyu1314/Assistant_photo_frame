import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    center: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
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

// 应用启动
app.whenReady().then(() => {
  createWindow()
  createTray()

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
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
