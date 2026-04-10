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
  previewDataUrl?: string  // PNG data URL for UI preview
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
          offscreen: true
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
      let image = await win.webContents.capturePage()
      let size = image.getSize()

      // On HiDPI screens, capturePage() returns an image scaled by the system
      // DPR (e.g. 960×1600 on a 2x display). Detect this and resize down to
      // the target 480×800. This is more reliable than enableDeviceEmulation
      // which can trigger Chromium-level crashes in offscreen windows.
      if (size.width !== RENDER_WIDTH || size.height !== RENDER_HEIGHT) {
        const scaleX = size.width / RENDER_WIDTH
        const scaleY = size.height / RENDER_HEIGHT

        // Only auto-fix if it's an exact integer multiple (e.g. 2x, 3x)
        if (Number.isInteger(scaleX) && Number.isInteger(scaleY) && scaleX === scaleY) {
          console.warn(
            `[OffscreenRenderer] DPR scaling detected (${scaleX}x), resizing ${size.width}×${size.height} → ${RENDER_WIDTH}×${RENDER_HEIGHT}`
          )
          image = image.resize({ width: RENDER_WIDTH, height: RENDER_HEIGHT })
          size = image.getSize()
        } else {
          return {
            success: false,
            error: `Size mismatch: expected ${RENDER_WIDTH}×${RENDER_HEIGHT}, got ${size.width}×${size.height}`
          }
        }
      }

      // Generate PNG data URL for UI preview
      const pngBuffer = image.toPNG()
      const previewDataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`

      // Get raw bitmap data
      // IMPORTANT: On Windows, toBitmap() returns BGRA format (platform-dependent).
      // We must convert to RGBA for correct color processing downstream.
      const bitmap = image.toBitmap()
      const rawPixels = new Uint8Array(bitmap.buffer, bitmap.byteOffset, bitmap.byteLength)

      // Verify expected buffer length
      const expectedLength = RENDER_WIDTH * RENDER_HEIGHT * 4
      if (rawPixels.length !== expectedLength) {
        return {
          success: false,
          error: `Bitmap buffer size mismatch: expected ${expectedLength}, got ${rawPixels.length}`
        }
      }

      // Convert BGRA → RGBA by swapping R↔B channels
      // toBitmap() format is platform-dependent: Windows uses BGRA, macOS uses RGBA.
      // We detect the platform and swap only on Windows to ensure correct color output.
      const rgba = new Uint8Array(rawPixels.length)
      if (process.platform === 'win32') {
        console.log('[OffscreenRenderer] Windows detected, converting BGRA → RGBA')
        for (let i = 0; i < rawPixels.length; i += 4) {
          rgba[i]     = rawPixels[i + 2]  // R ← B
          rgba[i + 1] = rawPixels[i + 1]  // G ← G
          rgba[i + 2] = rawPixels[i]      // B ← R
          rgba[i + 3] = rawPixels[i + 3]  // A ← A
        }
      } else {
        // macOS / Linux: already RGBA, just copy
        rgba.set(rawPixels)
      }

      return {
        success: true,
        rgba,
        width: RENDER_WIDTH,
        height: RENDER_HEIGHT,
        previewDataUrl
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
