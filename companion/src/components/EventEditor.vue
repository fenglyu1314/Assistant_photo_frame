<template>
  <div class="space-y-3">
    <h2 class="text-sm font-semibold text-slate-300">日程安排</h2>

    <!-- Add Event -->
    <div class="space-y-2">
      <input
        v-model="newTitle"
        placeholder="日程标题..."
        class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
      />
      <div class="flex gap-2">
        <input
          v-model="newDate"
          type="date"
          class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        />
        <input
          v-model="newTime"
          type="time"
          class="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        />
        <button
          @click="addEvent"
          :disabled="!newTitle.trim() || !newDate"
          class="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          添加
        </button>
      </div>
    </div>

    <!-- Event List -->
    <div class="space-y-1 max-h-36 overflow-y-auto">
      <div v-if="events.length === 0" class="text-xs text-slate-500 text-center py-3">
        近期无日程安排
      </div>
      <div
        v-for="event in events"
        :key="event.id"
        class="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-slate-800/50"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
        <span class="text-xs text-indigo-400 min-w-[50px] flex-shrink-0">{{ formatDate(event.date) }}</span>
        <span class="flex-1 text-xs text-slate-300 truncate">{{ event.title }}</span>
        <span v-if="event.time" class="text-xs text-slate-500">{{ event.time }}</span>
        <button
          @click="removeEvent(event.id)"
          class="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface CalendarEvent {
  id: string
  title: string
  date: string
  time?: string
  createdAt: string
}

const events = ref<CalendarEvent[]>([])
const newTitle = ref('')
const newDate = ref('')
const newTime = ref('')

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadEvents() {
  try {
    const result = await window.api.invoke('data:get-events') as CalendarEvent[]
    events.value = result
  } catch (err) {
    console.error('Failed to load events:', err)
  }
}

async function addEvent() {
  const title = newTitle.value.trim()
  if (!title || !newDate.value) return
  try {
    const newEvent = await window.api.invoke('data:add-event', {
      title,
      date: newDate.value,
      time: newTime.value || undefined
    }) as CalendarEvent
    events.value.push(newEvent)
    // Sort by date
    events.value.sort((a, b) => a.date.localeCompare(b.date))
    newTitle.value = ''
    newDate.value = ''
    newTime.value = ''
  } catch (err) {
    console.error('Failed to add event:', err)
  }
}

async function removeEvent(id: string) {
  try {
    const result = await window.api.invoke('data:remove-event', { id }) as { success: boolean }
    if (result.success) {
      events.value = events.value.filter(e => e.id !== id)
    }
  } catch (err) {
    console.error('Failed to remove event:', err)
  }
}

onMounted(() => {
  loadEvents()
})
</script>
