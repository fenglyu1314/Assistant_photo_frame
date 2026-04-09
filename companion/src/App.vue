<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
    <div class="text-center space-y-8 p-12">
      <!-- App Icon Placeholder -->
      <div class="mx-auto w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl">
        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>

      <!-- App Title -->
      <div>
        <h1 class="text-4xl font-bold text-white tracking-tight">
          Assistant Photo Frame
        </h1>
        <p class="mt-2 text-slate-400 text-lg">
          墨水屏桌面助手
        </p>
      </div>

      <!-- Version -->
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 border border-slate-600/50">
        <span class="text-sm text-slate-400">Version</span>
        <span class="text-sm font-mono text-indigo-400">{{ version }}</span>
      </div>

      <!-- Connection Status -->
      <div class="flex items-center justify-center gap-3 text-slate-400">
        <span class="relative flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>
        <span class="text-sm">设备未连接</span>
      </div>

      <!-- Info Cards -->
      <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
        <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p class="text-xs text-slate-500 uppercase tracking-wider">显示屏</p>
          <p class="mt-1 text-sm text-slate-300">7.3" 7色 e-Paper</p>
        </div>
        <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
          <p class="text-xs text-slate-500 uppercase tracking-wider">分辨率</p>
          <p class="mt-1 text-sm text-slate-300">480 × 800</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const version = __APP_VERSION__
</script>
