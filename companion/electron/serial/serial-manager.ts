/**
 * Serial Manager - Connection lifecycle management
 *
 * Manages ESP32 device scanning, connection, auto-reconnect,
 * frame buffer transmission, and PING/PONG heartbeat.
 */

import { EventEmitter } from 'events'
import { SerialPort } from 'serialport'
import { ResponseParser, type ParsedResponse } from './response-parser'
import {
  buildPingFrame,
  buildBeginFrame,
  buildDataFrame,
  buildEndFrame,
  FRAME_BUFFER_SIZE,
  DEFAULT_CHUNK_SIZE,
  CHUNK_ACK_TIMEOUT_MS,
  TRANSFER_TIMEOUT_MS,
  DISPLAY_DONE_TIMEOUT_MS,
  PING_TIMEOUT_MS,
  MAX_CHUNK_RETRIES
} from './binary-protocol'

// ============================================================================
// Types
// ============================================================================

export interface PortInfo {
  path: string
  vendorId?: string
  productId?: string
  manufacturer?: string
  serialNumber?: string
  isEsp32: boolean
}

export interface SerialState {
  connected: boolean
  portPath?: string
  deviceInfo?: {
    vendorId?: string
    productId?: string
  }
  error?: string
}

export interface TransferProgress {
  chunkIndex: number
  totalChunks: number
  percent: number
}

export interface PingResult {
  alive: boolean
  latencyMs?: number
}

export interface TransferResult {
  success: boolean
  error?: string
  durationMs?: number
}

// ============================================================================
// Constants
// ============================================================================

/** Espressif USB VID */
const ESP32_VID = '303A'

/** Auto-reconnect backoff limits */
const RECONNECT_INITIAL_MS = 1000
const RECONNECT_MAX_MS = 30000

// ============================================================================
// SerialManager
// ============================================================================

export class SerialManager extends EventEmitter {
  private port: SerialPort | null = null
  private parser: ResponseParser = new ResponseParser()
  private state: SerialState = { connected: false }
  private lastPortPath: string | null = null

  // Auto-reconnect state
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay: number = RECONNECT_INITIAL_MS
  private userDisconnected: boolean = false

  // Pending response waiters
  private responseWaiters: Array<{
    resolve: (resp: ParsedResponse) => void
    filter?: (resp: ParsedResponse) => boolean
  }> = []

  constructor() {
    super()
    this.parser.on('response', (resp: ParsedResponse) => {
      this.handleResponse(resp)
    })
  }

  // ==========================================================================
  // Scanning
  // ==========================================================================

  /**
   * Scan system serial ports, marking ESP32 devices by VID.
   */
  async scan(): Promise<PortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => ({
      path: p.path,
      vendorId: p.vendorId,
      productId: p.productId,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      isEsp32: p.vendorId?.toUpperCase() === ESP32_VID
    }))
  }

  // ==========================================================================
  // Connection
  // ==========================================================================

  /**
   * Connect to a serial port and verify with PING.
   */
  async connect(portPath: string): Promise<{ success: boolean; error?: string }> {
    // Disconnect existing connection first
    if (this.port) {
      await this.disconnect()
    }

    this.userDisconnected = false
    this.stopReconnect()

    try {
      this.port = new SerialPort({
        path: portPath,
        baudRate: 115200,
        autoOpen: false
      })

      // Open the port
      await new Promise<void>((resolve, reject) => {
        this.port!.open((err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      // Bind events
      this.port.on('data', (data: Buffer) => {
        this.parser.feed(data)
      })

      this.port.on('close', () => {
        this.handlePortClose()
      })

      this.port.on('error', (err: Error) => {
        console.error('[SerialManager] Port error:', err.message)
        this.handlePortClose()
      })

      // Verify with PING
      const pingResult = await this.ping()
      if (!pingResult.alive) {
        // Device not responding, close port
        await this.closePort()
        return { success: false, error: 'Device not responding' }
      }

      // Connected successfully
      this.lastPortPath = portPath
      this.reconnectDelay = RECONNECT_INITIAL_MS
      this.updateState({ connected: true, portPath })
      return { success: true }
    } catch (err) {
      await this.closePort()
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  /**
   * Disconnect from serial port. Stops auto-reconnect.
   */
  async disconnect(): Promise<{ success: boolean }> {
    this.userDisconnected = true
    this.stopReconnect()
    await this.closePort()
    this.updateState({ connected: false })
    return { success: true }
  }

  // ==========================================================================
  // PING
  // ==========================================================================

  /**
   * Send PING and wait for PONG.
   */
  async ping(): Promise<PingResult> {
    if (!this.port?.isOpen) {
      return { alive: false }
    }

    const start = Date.now()

    try {
      this.writeToPort(buildPingFrame())

      const resp = await this.waitForResponse(
        (r) => r.type === 'pong',
        PING_TIMEOUT_MS
      )

      if (resp) {
        return { alive: true, latencyMs: Date.now() - start }
      }
      return { alive: false }
    } catch {
      return { alive: false }
    }
  }

  // ==========================================================================
  // Frame Buffer Transfer
  // ==========================================================================

  /**
   * Send a complete frame buffer using BEGIN → DATA×N → END protocol.
   */
  async sendFrameBuffer(
    buffer: Uint8Array,
    onProgress?: (progress: TransferProgress) => void
  ): Promise<TransferResult> {
    if (!this.port?.isOpen) {
      return { success: false, error: 'Not connected' }
    }

    if (buffer.length !== FRAME_BUFFER_SIZE) {
      return {
        success: false,
        error: `Buffer size mismatch: expected ${FRAME_BUFFER_SIZE}, got ${buffer.length}`
      }
    }

    const startTime = Date.now()
    const chunkSize = DEFAULT_CHUNK_SIZE
    const totalChunks = Math.ceil(FRAME_BUFFER_SIZE / chunkSize)

    try {
      // --- BEGIN ---
      this.writeToPort(buildBeginFrame(FRAME_BUFFER_SIZE, chunkSize, totalChunks))

      const beginAck = await this.waitForResponse(
        (r) => r.type === 'ack' && r.chunkIndex === 0,
        CHUNK_ACK_TIMEOUT_MS
      )
      if (!beginAck) {
        return { success: false, error: 'BEGIN not acknowledged (timeout)' }
      }

      // --- DATA chunks ---
      for (let i = 0; i < totalChunks; i++) {
        // Check overall timeout
        if (Date.now() - startTime > TRANSFER_TIMEOUT_MS) {
          return { success: false, error: 'Transfer timeout exceeded' }
        }

        const offset = i * chunkSize
        const end = Math.min(offset + chunkSize, FRAME_BUFFER_SIZE)
        const chunkData = Buffer.from(buffer.slice(offset, end))

        let success = false
        for (let retry = 0; retry <= MAX_CHUNK_RETRIES; retry++) {
          this.writeToPort(buildDataFrame(i, chunkData))

          const resp = await this.waitForResponse(
            (r) =>
              (r.type === 'ack' || r.type === 'nak') && r.chunkIndex === i,
            CHUNK_ACK_TIMEOUT_MS
          )

          if (resp?.type === 'ack') {
            success = true
            break
          }

          // NAK or timeout → retry
          if (retry === MAX_CHUNK_RETRIES) {
            const reason = resp?.type === 'nak' ? 'NAK received' : 'ACK timeout'
            return {
              success: false,
              error: `Chunk ${i} failed after ${MAX_CHUNK_RETRIES} retries: ${reason}`
            }
          }
        }

        if (!success) {
          return { success: false, error: `Chunk ${i} transfer failed` }
        }

        // Report progress
        if (onProgress) {
          onProgress({
            chunkIndex: i,
            totalChunks,
            percent: Math.round(((i + 1) / totalChunks) * 100)
          })
        }
      }

      // --- END ---
      this.writeToPort(buildEndFrame())

      const displayDone = await this.waitForResponse(
        (r) => r.type === 'display-done',
        DISPLAY_DONE_TIMEOUT_MS
      )

      if (!displayDone) {
        return { success: false, error: 'DISPLAY_DONE not received (timeout)' }
      }

      return { success: true, durationMs: Date.now() - startTime }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  // ==========================================================================
  // Status
  // ==========================================================================

  /**
   * Get current connection status.
   */
  getStatus(): SerialState {
    return { ...this.state }
  }

  // ==========================================================================
  // Internal helpers
  // ==========================================================================

  private writeToPort(data: Buffer): void {
    if (this.port?.isOpen) {
      this.port.write(data)
    }
  }

  /**
   * Wait for a response matching the filter, with timeout.
   * Returns null on timeout.
   */
  private waitForResponse(
    filter: (resp: ParsedResponse) => boolean,
    timeoutMs: number
  ): Promise<ParsedResponse | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        // Remove this waiter
        const idx = this.responseWaiters.findIndex((w) => w.resolve === wrappedResolve)
        if (idx >= 0) this.responseWaiters.splice(idx, 1)
        resolve(null)
      }, timeoutMs)

      const wrappedResolve = (resp: ParsedResponse): void => {
        clearTimeout(timer)
        resolve(resp)
      }

      this.responseWaiters.push({ resolve: wrappedResolve, filter })
    })
  }

  /**
   * Route parsed responses to waiting callers.
   */
  private handleResponse(resp: ParsedResponse): void {
    // Find the first matching waiter
    for (let i = 0; i < this.responseWaiters.length; i++) {
      const waiter = this.responseWaiters[i]
      if (!waiter.filter || waiter.filter(resp)) {
        this.responseWaiters.splice(i, 1)
        waiter.resolve(resp)
        return
      }
    }
    // No waiter matched — response is dropped (or could be logged)
  }

  /**
   * Handle serial port close/error event.
   */
  private handlePortClose(): void {
    const wasConnected = this.state.connected
    this.port = null
    this.parser.reset()

    // Clear all pending waiters
    this.responseWaiters.forEach((w) => w.resolve({ type: 'pong' } as ParsedResponse))
    this.responseWaiters = []

    if (wasConnected) {
      this.updateState({ connected: false, error: 'Connection lost' })

      // Start auto-reconnect if not user-initiated disconnect
      if (!this.userDisconnected && this.lastPortPath) {
        this.startReconnect()
      }
    }
  }

  /**
   * Safely close the serial port.
   */
  private closePort(): Promise<void> {
    return new Promise((resolve) => {
      if (this.port?.isOpen) {
        this.port.close((err) => {
          if (err) {
            console.error('[SerialManager] Error closing port:', err.message)
          }
          this.port = null
          this.parser.reset()
          resolve()
        })
      } else {
        this.port = null
        this.parser.reset()
        resolve()
      }
    })
  }

  /**
   * Update state and emit event.
   */
  private updateState(newState: Partial<SerialState>): void {
    this.state = { ...this.state, ...newState }
    this.emit('state-changed', this.getStatus())
  }

  // ==========================================================================
  // Auto-reconnect
  // ==========================================================================

  private startReconnect(): void {
    if (this.reconnectTimer) return

    console.log(
      `[SerialManager] Starting auto-reconnect (delay: ${this.reconnectDelay}ms)`
    )

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null

      if (this.userDisconnected || !this.lastPortPath) return

      // Check if device is still available
      const ports = await this.scan()
      const device = ports.find((p) => p.path === this.lastPortPath && p.isEsp32)

      if (device) {
        console.log(`[SerialManager] Device found, attempting reconnect...`)
        const result = await this.connect(this.lastPortPath!)
        if (result.success) {
          console.log('[SerialManager] Reconnected successfully')
          return
        }
      }

      // Failed — exponential backoff
      this.reconnectDelay = Math.min(
        this.reconnectDelay * 2,
        RECONNECT_MAX_MS
      )
      this.startReconnect()
    }, this.reconnectDelay)
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectDelay = RECONNECT_INITIAL_MS
  }

  /**
   * Clean up resources (call on app quit)
   */
  async destroy(): Promise<void> {
    this.stopReconnect()
    await this.closePort()
    this.removeAllListeners()
  }
}
