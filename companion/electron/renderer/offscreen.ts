/**
 * Offscreen Renderer
 *
 * Creates a hidden BrowserWindow (480×800, offscreen mode) to render
 * HTML templates and capture the result as RGBA pixel data.
 *
 * Window is created per-render and destroyed immediately after capture.
 */

import { BrowserWindow } from 'electron'
import { join } from 'path'
import type { DashboardData } from '../data/data-manager'

// ============================================================================
// Constants
// ============================================================================

const RENDER_WIDTH = 480
const RENDER_HEIGHT = 800
const RENDER_TIMEOUT_MS = 10_000
const POST_LOAD_DELAY_MS = 100

// ============================================================================
// Types
// ============================================================================

export interface RenderResult {
  success: boolean
  rgba?: Uint8Array
  width?: number
  height?: number
  error?: string
}

// ============================================================================
// OffscreenRenderer
// ============================================================================

export class OffscreenRenderer {
  private templatesDir: string

  constructor() {
    // In dev: templates/ is at project root
    // In production: templates/ is copied alongside the main process output
    this.templatesDir = join(__dirname, '../../templates')
  }

  /**
   * Render dashboard data into RGBA pixel buffer.
   *
   * Creates a hidden offscreen BrowserWindow, loads the dashboard template
   * with data injected via URL query, captures the page, and destroys the window.
   */
  async render(data: DashboardData): Promise<RenderResult> {
    let win: BrowserWindow | null = null

    try {
      // Create offscreen window
      win = new BrowserWindow({
        show: false,
        width: RENDER_WIDTH,
        height: RENDER_HEIGHT,
        webPreferences: {
          offscreen: true,
          // @ts-ignore - deviceScaleFactor may not be in older type defs
          deviceScaleFactor: 1
        },
        // Ensure exact pixel dimensions
        useContentSize: true,
        resizable: false,
        frame: false
      })

      // Prepare data injection via URL query
      const jsonData = encodeURIComponent(JSON.stringify(data))
      const templatePath = join(this.templatesDir, 'dashboard.html')

      // Load template with data query parameter
      const loadPromise = this.waitForLoad(win)
      win.loadFile(templatePath, {
        query: { data: jsonData }
      })

      // Wait for page load with timeout
      const loaded = await Promise.race([
        loadPromise.then(() => true),
        this.timeout(RENDER_TIMEOUT_MS).then(() => false)
      ])

      if (!loaded) {
        return { success: false, error: 'Render timeout (10s)' }
      }

      // Small delay to ensure CSS is fully applied
      await new Promise(resolve => setTimeout(resolve, POST_LOAD_DELAY_MS))

      // Capture the page
      const image = await win.webContents.capturePage()
      const size = image.getSize()

      // Validate dimensions
      if (size.width !== RENDER_WIDTH || size.height !== RENDER_HEIGHT) {
        return {
          success: false,
          error: `Size mismatch: expected ${RENDER_WIDTH}×${RENDER_HEIGHT}, got ${size.width}×${size.height}`
        }
      }

      // Get RGBA bitmap
      const bitmap = image.toBitmap()
      const rgba = new Uint8Array(bitmap.buffer, bitmap.byteOffset, bitmap.byteLength)

      // Verify expected RGBA length
      const expectedLength = RENDER_WIDTH * RENDER_HEIGHT * 4
      if (rgba.length !== expectedLength) {
        return {
          success: false,
          error: `RGBA buffer size mismatch: expected ${expectedLength}, got ${rgba.length}`
        }
      }

      return {
        success: true,
        rgba,
        width: RENDER_WIDTH,
        height: RENDER_HEIGHT
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: `Render failed: ${message}` }
    } finally {
      // Always destroy the window
      if (win && !win.isDestroyed()) {
        win.destroy()
      }
    }
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private waitForLoad(win: BrowserWindow): Promise<void> {
    return new Promise((resolve) => {
      win.webContents.on('did-finish-load', () => {
        resolve()
      })
    })
  }

  private timeout(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
