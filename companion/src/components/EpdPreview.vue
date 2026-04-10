<template>
  <div class="flex flex-col items-center gap-4 p-4 w-full">
    <!-- Preview Area -->
    <div
      class="relative bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all"
      style="width: 240px; height: 400px;"
      @click="!previewing && executePreview()"
      :title="previewing ? '渲染中...' : '点击刷新预览'"
    >
      <img
        v-if="previewSrc"
        :src="previewSrc"
        alt="EPD Preview"
        class="w-full h-full object-contain"
      />
      <div v-else class="w-full h-full flex items-center justify-center text-slate-400 text-sm">
        <div class="text-center space-y-2">
          <svg class="w-12 h-12 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-xs">点击刷新预览</p>
        </div>
      </div>
    </div>

    <!-- Stage Progress -->
    <div v-if="previewing || syncing" class="w-full max-w-xs space-y-2">
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

const previewStages = ['collecting', 'rendering', 'enhancing', 'quantizing', 'encoding'] as const
type PreviewStage = typeof previewStages[number]

// Operation states
const previewing = ref(false)
const syncing = ref(false)
const currentStage = ref<string>('')
const stageMessage = ref('')
const transferPercent = ref(0)
const resultMessage = ref('')
const resultSuccess = ref(false)
const previewSrc = ref('')

// Device & cache state
const deviceConnected = ref(false)
const hasCache = ref(false)

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

/**
 * Task 3.2: 刷新预览 — 只渲染不发送
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
    }

    if (result.success) {
      resultSuccess.value = true
      const seconds = result.durationMs ? (result.durationMs / 1000).toFixed(1) : '?'
      resultMessage.value = `✓ 预览已生成 (${seconds}s)`
      if (result.previewDataUrl) {
        previewSrc.value = result.previewDataUrl
      }
      hasCache.value = true
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
 * Task 3.3: 同步到墨水屏 — 发送缓存帧到设备
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
 * Task 3.4: Fetch initial device status and cache state
 */
async function fetchInitialState() {
  try {
    const serialStatus = await window.api.invoke('serial:status') as { connected: boolean }
    deviceConnected.value = serialStatus.connected

    const pipelineStatus = await window.api.invoke('pipeline:status') as { hasCache: boolean }
    hasCache.value = pipelineStatus.hasCache
  } catch {
    // Silently ignore — will update via events
  }
}

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
