<template>
  <div class="h-screen flex bg-slate-900 text-slate-200 overflow-hidden">
    <!-- Left Panel: Control Area (40%) -->
    <div class="w-2/5 flex flex-col border-r border-slate-700 overflow-y-auto">
      <div class="p-4 space-y-4">
        <!-- App Header -->
        <div class="flex items-center gap-3 pb-3 border-b border-slate-700">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 class="text-sm font-semibold text-white">Assistant Photo Frame</h1>
            <p class="text-xs text-slate-500">v{{ version }}</p>
          </div>
        </div>

        <!-- Serial Panel -->
        <SerialPanel />

        <!-- Todo Editor -->
        <TodoEditor />

        <!-- Event Editor -->
        <EventEditor />

        <!-- Weather Panel -->
        <WeatherPanel />
      </div>
    </div>

    <!-- Right Panel: EPD Preview (60%) -->
    <div class="w-3/5 flex items-center justify-center bg-slate-800">
      <EpdPreview />
    </div>
  </div>
</template>

<script setup lang="ts">
import SerialPanel from './components/SerialPanel.vue'
import TodoEditor from './components/TodoEditor.vue'
import EventEditor from './components/EventEditor.vue'
import WeatherPanel from './components/WeatherPanel.vue'
import EpdPreview from './components/EpdPreview.vue'

const version = __APP_VERSION__
</script>
