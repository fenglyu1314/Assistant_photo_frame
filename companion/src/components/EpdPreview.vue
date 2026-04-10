<template>
  <div class="flex flex-col items-center gap-3 p-4 w-full">
    <!-- Tab Bar + Zoom Controls -->
    <div class="flex items-center justify-between w-full max-w-lg">
      <!-- Tab Switcher: 原图 / 量化图 -->
      <div class="flex bg-slate-800 rounded-lg p-0.5">
        <button
          @click="activeTab = 'quantized'"
          class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
          :class="activeTab === 'quantized'
            ? 'bg-indigo-600 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'"
        >
          量化图
        </button>
        <button
          @click="activeTab = 'original'"
          class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
          :class="activeTab === 'original'
            ? 'bg-indigo-600 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'"
        >
          原图
        </button>
      </div>

      <!-- Zoom Controls -->
      <div class="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
        <button
          v-for="level in zoomLevels"
          :key="level.value"
          @click="setZoom(level.value)"
          class="px-2 py-1 text-xs font-medium rounded-md transition-colors"
          :class="zoomLevel === level.value
            ? 'bg-emerald-600 text-white shadow'
            : 'text-slate-400 hover:text-slate-200'"
        >
          {{ level.label }}
        </button>
      </div>
    </div>

    <!-- Preview Area -->
    <div
      ref="containerRef"
      class="relative bg-white rounded-lg shadow-lg transition-all"
      :class="[
        isFitMode ? 'overflow-hidden' : 'overflow-auto',
        isDragging ? 'cursor-grabbing' : (!isFitMode && currentSrc ? 'cursor-grab' : 'cursor-pointer')
      ]"
      :style="containerStyle"
      @wheel="handleWheel"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
    >
      <!-- Image display -->
      <img
        v-if="currentSrc"
        :src="currentSrc"
        alt="EPD Preview"
        :class="imageClass"
        :style="imageStyle"
        draggable="false"
      />

      <!-- Empty state -->
      <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-sm"
        @click="!previewing && executePreview()"
      >
        <div class="text-center space-y-2">
          <svg class="w-12 h-12 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-xs">点击刷新预览</p>
        </div>
      </div>
    </div>

    <!-- Color Statistics Bar -->
    <div v-if="colorStats.length > 0" class="w-full max-w-lg">
      <!-- Color bar (proportional width blocks) -->
      <div class="flex w-full h-4 rounded-md overflow-hidden shadow-inner">
        <div
          v-for="stat in colorStats"
          :key="stat.index"
          :style="{ width: stat.percent + '%', backgroundColor: colorCssMap[stat.index] }"
          class="transition-all duration-300"
          :title="`${stat.name}: ${stat.percent}%`"
        ></div>
      </div>
      <!-- Legend -->
      <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 justify-center">
        <div
          v-for="stat in colorStats"
          :key="'legend-' + stat.index"
          class="flex items-center gap-1"
          v-show="stat.percent > 0"
        >
          <span
            class="w-2.5 h-2.5 rounded-sm inline-block border border-slate-600"
            :style="{ backgroundColor: colorCssMap[stat.index] }"
          ></span>
          <span class="text-[10px] text-slate-400">{{ stat.name }} {{ stat.percent }}%</span>
        </div>
      </div>
    </div>

    <!-- Quantization Parameters Panel -->
    <div class="w-full max-w-lg">
      <!-- Collapsible Header -->
      <button
        @click="qParamsPanelOpen = !qParamsPanelOpen"
        class="flex items-center justify-between w-full px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-xs text-slate-400 hover:text-slate-300"
      >
        <span class="font-medium">量化参数</span>
        <svg
          class="w-3.5 h-3.5 transition-transform"
          :class="qParamsPanelOpen ? 'rotate-180' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Panel Content -->
      <div v-show="qParamsPanelOpen" class="mt-2 space-y-3 px-1">
        <!-- No-cache warning -->
        <div v-if="!hasRgbaCache" class="text-xs text-amber-400/80 text-center py-2">
          请先刷新预览
        </div>

        <!-- Requantize progress -->
        <div v-if="requantizing" class="text-xs text-indigo-400 text-center py-1 animate-pulse">
          重新量化中...
        </div>

        <!-- Sliders -->
        <div class="space-y-2.5" :class="{ 'opacity-40 pointer-events-none': !hasRgbaCache }">
          <!-- Saturation Factor -->
          <div class="flex items-center gap-2">
            <label class="text-[11px] text-slate-400 w-20 shrink-0 text-right">饱和度</label>
            <input
              type="range"
              :min="0.5" :max="3.0" :step="0.1"
              v-model.number="qParams.saturationFactor"
              @input="onParamChange"
              class="flex-1 h-1 accent-indigo-500 bg-slate-700 rounded-full appearance-none cursor-pointer"
            />
            <span class="text-[11px] text-slate-300 w-10 text-right font-mono">{{ qParams.saturationFactor.toFixed(1) }}</span>
          </div>

          <!-- Dither Threshold -->
          <div class="flex items-center gap-2">
            <label class="text-[11px] text-slate-400 w-20 shrink-0 text-right">抖动阈值</label>
            <input
              type="range"
              :min="0" :max="50000" :step="1000"
              v-model.number="qParams.ditherThreshold"
              @input="onParamChange"
              class="flex-1 h-1 accent-indigo-500 bg-slate-700 rounded-full appearance-none cursor-pointer"
            />
            <span class="text-[11px] text-slate-300 w-10 text-right font-mono">{{ qParams.ditherThreshold }}</span>
          </div>

          <!-- Gray Spread -->
          <div class="flex items-center gap-2">
            <label class="text-[11px] text-slate-400 w-20 shrink-0 text-right">灰色极差</label>
            <input
              type="range"
              :min="0" :max="100" :step="5"
              v-model.number="qParams.graySpread"
              @input="onParamChange"
              class="flex-1 h-1 accent-indigo-500 bg-slate-700 rounded-full appearance-none cursor-pointer"
            />
            <span class="text-[11px] text-slate-300 w-10 text-right font-mono">{{ qParams.graySpread }}</span>
          </div>

          <!-- Gray Luminance Midpoint -->
          <div class="flex items-center gap-2">
            <label class="text-[11px] text-slate-400 w-20 shrink-0 text-right">灰色中点</label>
            <input
              type="range"
              :min="50" :max="200" :step="1"
              v-model.number="qParams.grayLuminanceMidpoint"
              @input="onParamChange"
              class="flex-1 h-1 accent-indigo-500 bg-slate-700 rounded-full appearance-none cursor-pointer"
            />
            <span class="text-[11px] text-slate-300 w-10 text-right font-mono">{{ qParams.grayLuminanceMidpoint }}</span>
          </div>
        </div>

        <!-- Reset button -->
        <div class="flex justify-center pt-1" :class="{ 'opacity-40 pointer-events-none': !hasRgbaCache }">
          <button
            @click="resetParams"
            class="px-3 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
          >
            恢复默认值
          </button>
        </div>
      </div>
    </div>

    <!-- Stage Progress -->
    <div v-if="previewing || syncing" class="w-full max-w-lg space-y-2">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full animate-pulse" :class="syncing ? 'bg-emerald-500' : 'bg-indigo-500'"></div>
        <span class="text-xs text-slate-400">{{ stageMessage }}</span>
      </div>

      <!-- Stage Pills (preview stages 1-5) -->
      <div v-if="previewing" class="flex gap-1">
        <div
          v-for="s in previewStages"
          :key="s"
          class="flex-1 h-1.5 rounded-full transition-colors"
          :class="getPreviewStageClass(s)"
        ></div>
      </div>

      <!-- Transfer Progress Bar (sync stage 6) -->
      <div v-if="syncing && transferPercent > 0" class="space-y-1">
        <div class="w-full bg-slate-700 rounded-full h-1.5">
          <div
            class="bg-emerald-500 h-1.5 rounded-full transition-all"
            :style="{ width: `${transferPercent}%` }"
          ></div>
        </div>
        <p class="text-xs text-slate-500 text-center">{{ transferPercent }}%</p>
      </div>
    </div>

    <!-- Result Message -->
    <div v-if="resultMessage" class="text-xs" :class="resultSuccess ? 'text-green-400' : 'text-red-400'">
      {{ resultMessage }}
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-3">
      <!-- 刷新预览 Button -->
      <button
        @click="executePreview"
        :disabled="previewing || syncing"
        class="px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
      >
        {{ previewing ? '渲染中...' : '刷新预览' }}
      </button>

      <!-- 同步到墨水屏 Button -->
      <button
        @click="executeSync"
        :disabled="!canSync"
        class="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
        :title="syncButtonTitle"
      >
        {{ syncing ? '同步中...' : '同步到墨水屏' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useZoomPan, type ZoomLevel } from '../composables/useZoomPan'

// ---------------------------------------------------------------------------
// Zoom & Pan
// ---------------------------------------------------------------------------

const {
  zoomLevel,
  isFitMode,
  scaleValue,
  setZoom,
  handleWheel,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  isDragging,
} = useZoomPan()

const containerRef = ref<HTMLElement | null>(null)

const zoomLevels: { value: ZoomLevel; label: string }[] = [
  { value: 'fit', label: '适应' },
  { value: '50', label: '50%' },
  { value: '75', label: '75%' },
  { value: '100', label: '100%' },
]

// EPD logical dimensions
const EPD_W = 480
const EPD_H = 800

/** Container style: fixed aspect ratio container in fit mode, scrollable in zoom mode */
const containerStyle = computed(() => {
  if (isFitMode.value) {
    // Fit mode: fixed container, image scales to fit
    return {
      width: '240px',
      height: '400px',
    }
  }
  // Zoom modes: container allows scrolling, constrain max size
  return {
    width: `${Math.min(EPD_W * scaleValue.value, 500)}px`,
    height: `${Math.min(EPD_H * scaleValue.value, 600)}px`,
    maxWidth: '100%',
    maxHeight: '70vh',
  }
})

/** Image class for rendering quality */
const imageClass = computed(() => {
  const base = 'select-none'
  if (isFitMode.value) {
    return `${base} w-full h-full object-contain`
  }
  // Non-fit: pixelated rendering for sharp edges at zoom
  return base
})

/** Image style for zoom modes */
const imageStyle = computed(() => {
  if (isFitMode.value) {
    return {}
  }
  return {
    width: `${EPD_W * scaleValue.value}px`,
    height: `${EPD_H * scaleValue.value}px`,
    imageRendering: 'pixelated' as const,
  }
})

// ---------------------------------------------------------------------------
// Tab switching & dual-image state
// ---------------------------------------------------------------------------

const activeTab = ref<'original' | 'quantized'>('quantized')
const previewSrc = ref('')
const quantizedSrc = ref('')

/** Current displayed image based on active tab */
const currentSrc = computed(() => {
  return activeTab.value === 'quantized' ? quantizedSrc.value : previewSrc.value
})

// ---------------------------------------------------------------------------
// Color statistics
// ---------------------------------------------------------------------------

interface ColorStat {
  index: number
  name: string
  count: number
  percent: number
}

const colorStats = ref<ColorStat[]>([])

/** CSS color mapping for the 6 EPD colors */
const colorCssMap: Record<number, string> = {
  0: '#000000',  // BLACK
  1: '#FFFFFF',  // WHITE
  2: '#FFD700',  // YELLOW (slightly gold for visibility on dark bg)
  3: '#FF0000',  // RED
  5: '#0066FF',  // BLUE
  6: '#00CC00',  // GREEN
}

// ---------------------------------------------------------------------------
// Stage progress & operation state
// ---------------------------------------------------------------------------

const previewStages = ['collecting', 'rendering', 'enhancing', 'quantizing', 'encoding'] as const
type PreviewStage = typeof previewStages[number]

const previewing = ref(false)
const syncing = ref(false)
const currentStage = ref<string>('')
const stageMessage = ref('')
const transferPercent = ref(0)
const resultMessage = ref('')
const resultSuccess = ref(false)

// Device & cache state
const deviceConnected = ref(false)
const hasCache = ref(false)
const hasRgbaCache = ref(false)

// ---------------------------------------------------------------------------
// Quantization Parameters Panel
// ---------------------------------------------------------------------------

const qParamsPanelOpen = ref(false)
const requantizing = ref(false)

const DEFAULT_PARAMS = {
  saturationFactor: 1.4,
  ditherThreshold: 24000,
  graySpread: 40,
  grayLuminanceMidpoint: 128,
}

const qParams = ref({ ...DEFAULT_PARAMS })

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onParamChange() {
  if (!hasRgbaCache.value) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    triggerRequantize()
  }, 300)
}

function resetParams() {
  qParams.value = { ...DEFAULT_PARAMS }
  if (hasRgbaCache.value) {
    triggerRequantize()
  }
}

async function triggerRequantize() {
  requantizing.value = true
  try {
    // Spread to create a plain object — Vue reactive Proxy cannot be structured-cloned by Electron IPC
    const result = await window.api.invoke('pipeline:requantize', { params: { ...qParams.value } }) as {
      success: boolean
      error?: string
      durationMs?: number
      quantizedDataUrl?: string
      colorStats?: ColorStat[]
    }
    if (result.success) {
      if (result.quantizedDataUrl) {
        quantizedSrc.value = result.quantizedDataUrl
      }
      if (result.colorStats) {
        colorStats.value = result.colorStats
      }
    } else {
      resultSuccess.value = false
      resultMessage.value = result.error || '重量化失败'
    }
  } catch (err) {
    resultSuccess.value = false
    resultMessage.value = `重量化异常: ${err}`
  } finally {
    requantizing.value = false
  }
}

const canSync = computed(() => {
  return hasCache.value && deviceConnected.value && !previewing.value && !syncing.value
})

const syncButtonTitle = computed(() => {
  if (syncing.value) return '正在同步...'
  if (!hasCache.value) return '请先刷新预览'
  if (!deviceConnected.value) return '墨水屏未连接'
  return '将预览内容同步到墨水屏'
})

const previewStageIndex = computed(() => {
  if (!currentStage.value) return -1
  return previewStages.indexOf(currentStage.value as PreviewStage)
})

function getPreviewStageClass(stage: PreviewStage): string {
  const si = previewStages.indexOf(stage)
  if (si < previewStageIndex.value) return 'bg-indigo-500'
  if (si === previewStageIndex.value) return 'bg-indigo-400 animate-pulse'
  return 'bg-slate-700'
}

// ---------------------------------------------------------------------------
// IPC event handlers
// ---------------------------------------------------------------------------

function onStageProgress(...args: unknown[]) {
  const progress = args[0] as { stage: string; message: string }
  currentStage.value = progress.stage
  stageMessage.value = progress.message
}

function onTransferProgress(...args: unknown[]) {
  const progress = args[0] as { chunkIndex: number; totalChunks: number; percent: number }
  transferPercent.value = progress.percent
}

function onSerialStateChanged(...args: unknown[]) {
  const state = args[0] as { connected: boolean }
  deviceConnected.value = state.connected
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * 刷新预览 — 只渲染不发送
 */
async function executePreview() {
  previewing.value = true
  resultMessage.value = ''
  currentStage.value = ''

  try {
    const result = await window.api.invoke('pipeline:render-preview') as {
      success: boolean
      error?: string
      durationMs?: number
      previewDataUrl?: string
      quantizedDataUrl?: string
      colorStats?: ColorStat[]
    }

    if (result.success) {
      resultSuccess.value = true
      const seconds = result.durationMs ? (result.durationMs / 1000).toFixed(1) : '?'
      resultMessage.value = `✓ 预览已生成 (${seconds}s)`
      if (result.previewDataUrl) {
        previewSrc.value = result.previewDataUrl
      }
      if (result.quantizedDataUrl) {
        quantizedSrc.value = result.quantizedDataUrl
      }
      if (result.colorStats) {
        colorStats.value = result.colorStats
      }
      hasCache.value = true
      hasRgbaCache.value = true
    } else {
      resultSuccess.value = false
      resultMessage.value = result.error || '预览失败'
    }
  } catch (err) {
    resultSuccess.value = false
    resultMessage.value = `异常: ${err}`
  } finally {
    previewing.value = false
    currentStage.value = ''
  }
}

/**
 * 同步到墨水屏 — 发送缓存帧到设备
 */
async function executeSync() {
  syncing.value = true
  resultMessage.value = ''
  transferPercent.value = 0
  stageMessage.value = '正在发送到墨水屏...'

  try {
    const result = await window.api.invoke('pipeline:sync-device') as {
      success: boolean
      error?: string
      durationMs?: number
    }

    if (result.success) {
      resultSuccess.value = true
      const seconds = result.durationMs ? (result.durationMs / 1000).toFixed(1) : '?'
      resultMessage.value = `✓ 同步成功 (${seconds}s)`
    } else {
      resultSuccess.value = false
      resultMessage.value = result.error || '同步失败'
    }
  } catch (err) {
    resultSuccess.value = false
    resultMessage.value = `异常: ${err}`
  } finally {
    syncing.value = false
    transferPercent.value = 0
    stageMessage.value = ''
  }
}

/**
 * Fetch initial device status and cache state
 */
async function fetchInitialState() {
  try {
    const serialStatus = await window.api.invoke('serial:status') as { connected: boolean }
    deviceConnected.value = serialStatus.connected

    const pipelineStatus = await window.api.invoke('pipeline:status') as { hasCache: boolean; hasRgbaCache?: boolean }
    hasCache.value = pipelineStatus.hasCache
    hasRgbaCache.value = pipelineStatus.hasRgbaCache ?? false
  } catch {
    // Silently ignore — will update via events
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
  window.api.on('pipeline:stage-progress', onStageProgress)
  window.api.on('serial:transfer-progress', onTransferProgress)
  window.api.on('serial:state-changed', onSerialStateChanged)
  fetchInitialState()
})

onUnmounted(() => {
  window.api.off('pipeline:stage-progress', onStageProgress)
  window.api.off('serial:transfer-progress', onTransferProgress)
  window.api.off('serial:state-changed', onSerialStateChanged)
})
</script>
