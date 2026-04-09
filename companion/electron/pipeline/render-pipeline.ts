/**
 * Render Pipeline
 *
 * Orchestrates the complete flow from data collection to e-Paper display:
 *   1. DataManager.collect()        → DashboardData
 *   2. OffscreenRenderer.render()   → NativeImage → RGBA Buffer
 *   3. enhanceSaturation(rgba)      → RGBA Buffer
 *   4. quantizeFloydSteinberg(rgba) → palette indices
 *   5. encodeToPhysicalBuffer(idx)  → 192KB Buffer
 *   6. SerialManager.sendFrameBuffer(buf) → TransferResult
 */

import { EventEmitter } from 'events'
import { DataManager } from '../data/data-manager'
import { OffscreenRenderer } from '../renderer/offscreen'
import { SerialManager, type TransferProgress } from '../serial/serial-manager'
import { enhanceSaturation, quantizeFloydSteinberg } from '@core/quantizer'
import { encodeToPhysicalBuffer } from '@core/buffer-encoder'
import { EPD_LOGICAL_W, EPD_LOGICAL_H } from '@core/palette'

// ============================================================================
// Types
// ============================================================================

export interface PipelineResult {
  success: boolean
  error?: string
  durationMs?: number
  previewDataUrl?: string  // PNG data URL for UI preview
}

export interface PipelineStatus {
  running: boolean
  lastRun?: string      // ISO timestamp
  lastError?: string
}

export interface StageProgress {
  stage: string
  message: string
}

// ============================================================================
// Pipeline stages
// ============================================================================

const STAGES = {
  COLLECTING: { stage: 'collecting', message: '正在收集数据...' },
  RENDERING: { stage: 'rendering', message: '正在渲染模板...' },
  ENHANCING: { stage: 'enhancing', message: '正在增强饱和度...' },
  QUANTIZING: { stage: 'quantizing', message: '正在量化为6色...' },
  ENCODING: { stage: 'encoding', message: '正在编码缓冲区...' },
  SENDING: { stage: 'sending', message: '正在发送到设备...' },
  DONE: { stage: 'done', message: '完成!' }
}

// ============================================================================
// RenderPipeline
// ============================================================================

export class RenderPipeline extends EventEmitter {
  private dataManager: DataManager
  private offscreen: OffscreenRenderer
  private serialManager: SerialManager
  private running: boolean = false
  private lastRun?: string
  private lastError?: string

  constructor(
    dataManager: DataManager,
    offscreen: OffscreenRenderer,
    serialManager: SerialManager
  ) {
    super()
    this.dataManager = dataManager
    this.offscreen = offscreen
    this.serialManager = serialManager
  }

  /**
   * Execute the complete render pipeline.
   * Returns result with success/error and timing info.
   */
  async execute(): Promise<PipelineResult> {
    // Concurrency guard
    if (this.running) {
      return { success: false, error: 'Pipeline already running' }
    }

    this.running = true
    const startTime = Date.now()

    try {
      // Stage 1: Collect data
      this.emitStage(STAGES.COLLECTING)
      const data = await this.dataManager.collect()

      // Stage 2: Render to RGBA
      this.emitStage(STAGES.RENDERING)
      const renderResult = await this.offscreen.render(data)
      if (!renderResult.success || !renderResult.rgba) {
        const error = `渲染失败: ${renderResult.error}`
        this.lastError = error
        return { success: false, error }
      }

      const rgba = renderResult.rgba

      // Save preview data URL for UI display
      const previewDataUrl = renderResult.previewDataUrl

      // Stage 3: Enhance saturation
      this.emitStage(STAGES.ENHANCING)
      const enhanced = enhanceSaturation(rgba, EPD_LOGICAL_W, EPD_LOGICAL_H)

      // Stage 4: Floyd-Steinberg quantization
      this.emitStage(STAGES.QUANTIZING)
      const indices = quantizeFloydSteinberg(enhanced, EPD_LOGICAL_W, EPD_LOGICAL_H)

      // Stage 5: Encode to physical buffer
      this.emitStage(STAGES.ENCODING)
      const buffer = encodeToPhysicalBuffer(indices)

      // Stage 6: Send to device
      this.emitStage(STAGES.SENDING)
      const transferResult = await this.serialManager.sendFrameBuffer(
        buffer,
        (progress: TransferProgress) => {
          this.emit('transfer-progress', progress)
        }
      )

      if (!transferResult.success) {
        const error = `发送失败: ${transferResult.error}`
        this.lastError = error
        return { success: false, error }
      }

      // Done!
      this.emitStage(STAGES.DONE)
      const durationMs = Date.now() - startTime
      this.lastRun = new Date().toISOString()
      this.lastError = undefined

      return { success: true, durationMs, previewDataUrl }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const error = `管线异常: ${message}`
      this.lastError = error
      return { success: false, error }
    } finally {
      this.running = false
    }
  }

  /**
   * Get current pipeline status.
   */
  getStatus(): PipelineStatus {
    return {
      running: this.running,
      lastRun: this.lastRun,
      lastError: this.lastError
    }
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private emitStage(stageInfo: StageProgress): void {
    this.emit('stage-progress', stageInfo)
  }
}
