<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-slate-300">串口连接</h2>
      <div class="flex items-center gap-2">
        <span class="relative flex h-2.5 w-2.5">
          <span v-if="state === 'connected'" class="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5" :class="statusDotClass"></span>
        </span>
        <span class="text-xs" :class="statusTextClass">{{ statusText }}</span>
      </div>
    </div>

    <!-- Port Selection -->
    <div class="flex gap-2">
      <select
        v-model="selectedPort"
        class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        :disabled="state === 'connected'"
      >
        <option value="">选择串口...</option>
        <option v-for="port in ports" :key="port.path" :value="port.path">
          {{ port.path }}{{ port.isEsp32 ? ' (ESP32)' : '' }}
        </option>
      </select>
      <button
        @click="scanPorts"
        :disabled="scanning || state === 'connected'"
        class="px-3 py-1.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {{ scanning ? '扫描中...' : '扫描' }}
      </button>
    </div>

    <!-- Connect/Disconnect Button -->
    <button
      v-if="state !== 'connected'"
      @click="connectDevice"
      :disabled="!selectedPort || connecting"
      class="w-full py-2 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      {{ connecting ? '连接中...' : '连接' }}
    </button>
    <button
      v-else
      @click="disconnectDevice"
      class="w-full py-2 text-xs font-medium rounded bg-red-600/80 hover:bg-red-500 text-white transition"
    >
      断开连接
    </button>

    <!-- Error Message -->
    <p v-if="errorMsg" class="text-xs text-red-400">{{ errorMsg }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface PortInfo {
  path: string
  vendorId?: string
  productId?: string
  manufacturer?: string
  isEsp32: boolean
}

const ports = ref<PortInfo[]>([])
const selectedPort = ref('')
const scanning = ref(false)
const connecting = ref(false)
const errorMsg = ref('')
const state = ref<'disconnected' | 'connected' | 'error'>('disconnected')

const statusDotClass = computed(() => ({
  'bg-green-500': state.value === 'connected',
  'bg-amber-500': connecting.value,
  'bg-red-500': state.value === 'error',
  'bg-slate-500': state.value === 'disconnected' && !connecting.value
}))

const statusTextClass = computed(() => ({
  'text-green-400': state.value === 'connected',
  'text-amber-400': connecting.value,
  'text-red-400': state.value === 'error',
  'text-slate-500': state.value === 'disconnected' && !connecting.value
}))

const statusText = computed(() => {
  if (connecting.value) return '连接中...'
  switch (state.value) {
    case 'connected': return '已连接'
    case 'error': return '连接错误'
    default: return '未连接'
  }
})

async function scanPorts() {
  scanning.value = true
  errorMsg.value = ''
  try {
    const result = await window.api.invoke('serial:scan') as PortInfo[]
    ports.value = result
    // Auto-select ESP32 device if found
    const esp32 = result.find(p => p.isEsp32)
    if (esp32 && !selectedPort.value) {
      selectedPort.value = esp32.path
    }
  } catch (err) {
    errorMsg.value = `扫描失败: ${err}`
  } finally {
    scanning.value = false
  }
}

async function connectDevice() {
  if (!selectedPort.value) return
  connecting.value = true
  errorMsg.value = ''
  try {
    const result = await window.api.invoke('serial:connect', { path: selectedPort.value }) as { success: boolean; error?: string }
    if (result.success) {
      state.value = 'connected'
    } else {
      state.value = 'error'
      errorMsg.value = result.error || '连接失败'
    }
  } catch (err) {
    state.value = 'error'
    errorMsg.value = `连接异常: ${err}`
  } finally {
    connecting.value = false
  }
}

async function disconnectDevice() {
  try {
    await window.api.invoke('serial:disconnect')
    state.value = 'disconnected'
    errorMsg.value = ''
  } catch (err) {
    errorMsg.value = `断开失败: ${err}`
  }
}

function onStateChanged(newState: { connected: boolean; error?: string }) {
  if (newState.connected) {
    state.value = 'connected'
  } else if (newState.error) {
    state.value = 'error'
    errorMsg.value = newState.error
  } else {
    state.value = 'disconnected'
  }
}

onMounted(async () => {
  window.api.on('serial:state-changed', onStateChanged)
  // Load initial status
  try {
    const status = await window.api.invoke('serial:status') as { connected: boolean; portPath?: string; error?: string }
    if (status.connected) {
      state.value = 'connected'
      if (status.portPath) selectedPort.value = status.portPath
    }
  } catch { /* ignore */ }
  // Auto-scan on mount
  await scanPorts()
})

onUnmounted(() => {
  window.api.off('serial:state-changed', onStateChanged)
})
</script>
