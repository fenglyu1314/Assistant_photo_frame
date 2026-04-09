<template>
  <div class="flex flex-col items-center gap-4 p-4 w-full">
    <!-- Preview Area -->
    <div
      class="relative bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-400 transition-all"
      style="width: 240px; height: 400px;"
      @click="!running && executeRefresh()"
      :title="running ? '刷新中...' : '点击刷新预览'"
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
    <div v-if="running" class="w-full max-w-xs space-y-2">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
        <span class="text-xs text-slate-400">{{ stageMessage }}</span>
      </div>

      <!-- Stage Pills -->
      <div class="flex gap-1">
        <div
          v-for="s in stages"
          :key="s"
          class="flex-1 h-1.5 rounded-full transition-colors"
          :class="getStageClass(s)"
        ></div>
      </div>

      <!-- Transfer Progress Bar -->
      <div v-if="currentStage === 'sending' && transferPercent > 0" class="space-y-1">
        <div class="w-full bg-slate-700 rounded-full h-1.5">
          <div
            class="bg-indigo-500 h-1.5 rounded-full transition-all"
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

    <!-- Refresh Button -->
    <button
      @click="executeRefresh"
      :disabled="running"
      class="px-6 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
    >
      {{ running ? '刷新中...' : '刷新墨水屏' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const stages = ['collecting', 'rendering', 'enhancing', 'quantizing', 'encoding', 'sending', 'done'] as const
type Stage = typeof stages[number]

const running = ref(false)
const currentStage = ref<Stage | ''>('')
const stageMessage = ref('')
const transferPercent = ref(0)
const resultMessage = ref('')
const resultSuccess = ref(false)
const previewSrc = ref('')

const stageIndex = computed(() => {
  if (!currentStage.value) return -1
  return stages.indexOf(currentStage.value as Stage)
})

function getStageClass(stage: Stage): string {
  const si = stages.indexOf(stage)
  if (si < stageIndex.value) return 'bg-indigo-500'
  if (si === stageIndex.value) return 'bg-indigo-400 animate-pulse'
  return 'bg-slate-700'
}

function onStageProgress(progress: { stage: string; message: string }) {
  currentStage.value = progress.stage as Stage
  stageMessage.value = progress.message
}

function onTransferProgress(progress: { chunkIndex: number; totalChunks: number; percent: number }) {
  transferPercent.value = progress.percent
}

async function executeRefresh() {
  running.value = true
  resultMessage.value = ''
  currentStage.value = ''
  transferPercent.value = 0

  try {
    const result = await window.api.invoke('pipeline:execute') as {
      success: boolean
      error?: string
      durationMs?: number
      previewDataUrl?: string
    }

    if (result.success) {
      resultSuccess.value = true
      const seconds = result.durationMs ? (result.durationMs / 1000).toFixed(1) : '?'
      resultMessage.value = `✓ 刷新成功 (${seconds}s)`
      // Display the rendered preview image
      if (result.previewDataUrl) {
        previewSrc.value = result.previewDataUrl
      }
    } else {
      resultSuccess.value = false
      resultMessage.value = result.error || '刷新失败'
    }
  } catch (err) {
    resultSuccess.value = false
    resultMessage.value = `异常: ${err}`
  } finally {
    running.value = false
    currentStage.value = ''
    transferPercent.value = 0
  }
}

onMounted(() => {
  window.api.on('pipeline:stage-progress', onStageProgress)
  window.api.on('serial:transfer-progress', onTransferProgress)
})

onUnmounted(() => {
  window.api.off('pipeline:stage-progress', onStageProgress)
  window.api.off('serial:transfer-progress', onTransferProgress)
})
</script>
