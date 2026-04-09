<template>
  <div class="space-y-3">
    <h2 class="text-sm font-semibold text-slate-300">天气配置</h2>

    <div class="space-y-2">
      <div>
        <label class="text-xs text-slate-500 block mb-1">和风天气 API Key</label>
        <input
          v-model="apiKey"
          type="password"
          placeholder="输入 API Key..."
          class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div>
        <label class="text-xs text-slate-500 block mb-1">
          API Host
          <span class="text-slate-600">（控制台 → 设置中获取）</span>
        </label>
        <input
          v-model="apiHost"
          placeholder="如: abc123.def.qweatherapi.com"
          class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>
      <div>
        <label class="text-xs text-slate-500 block mb-1">城市搜索</label>
        <div class="flex gap-1.5">
          <input
            v-model="cityQuery"
            placeholder="输入中文城市名，如: 深圳"
            class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            @keyup.enter="searchCity"
          />
          <button
            @click="searchCity"
            :disabled="searching || !cityQuery.trim()"
            class="px-2.5 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition whitespace-nowrap"
          >
            {{ searching ? '搜索中...' : '搜索' }}
          </button>
        </div>
        <!-- Search results -->
        <div v-if="searchResults.length > 0" class="mt-1.5 space-y-1">
          <button
            v-for="city in searchResults"
            :key="city.id"
            @click="selectCity(city)"
            class="w-full text-left px-2 py-1.5 text-xs rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-indigo-500 transition"
            :class="{ 'border-indigo-500 bg-slate-700': location === city.id }"
          >
            <span class="text-slate-300">{{ city.name }}</span>
            <span class="text-slate-500 ml-1">{{ city.adm1 }}, {{ city.country }}</span>
            <span class="text-slate-600 ml-1 text-[10px]">ID: {{ city.id }}</span>
          </button>
        </div>
        <p v-if="searchError" class="text-xs text-red-400 mt-1">{{ searchError }}</p>
      </div>
      <div>
        <label class="text-xs text-slate-500 block mb-1">Location ID</label>
        <input
          v-model="location"
          placeholder="通过搜索自动填入，或手动输入如: 101280601"
          class="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          readonly
        />
      </div>
      <button
        @click="saveConfig"
        :disabled="saving"
        class="w-full py-1.5 text-xs font-medium rounded bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 transition"
      >
        {{ saving ? '保存中...' : saved ? '✓ 已保存' : '保存' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const apiKey = ref('')
const apiHost = ref('')
const location = ref('')
const cityQuery = ref('')
const searching = ref(false)
const searchResults = ref<Array<{ name: string; id: string; adm1: string; adm2: string; country: string }>>([])
const searchError = ref('')
const saving = ref(false)
const saved = ref(false)

async function loadConfig() {
  try {
    const weather = await window.api.invoke('config:get', { key: 'weather' }) as {
      apiKey: string
      apiHost: string
      location: string
      unit: string
    } | null
    if (weather) {
      apiKey.value = weather.apiKey || ''
      apiHost.value = weather.apiHost || ''
      location.value = weather.location || ''
    }
  } catch (err) {
    console.error('Failed to load weather config:', err)
  }
}

async function searchCity() {
  const query = cityQuery.value.trim()
  if (!query) return

  // Must save config first so backend has API Key and Host
  if (!apiKey.value || !apiHost.value) {
    searchError.value = '请先填写并保存 API Key 和 API Host'
    return
  }

  // Auto-save before search so backend can use the credentials
  await saveConfigSilent()

  searching.value = true
  searchError.value = ''
  searchResults.value = []

  try {
    const result = await window.api.invoke('weather:search-city', { query }) as {
      success: boolean
      error?: string
      results: Array<{ name: string; id: string; adm1: string; adm2: string; country: string }>
    }
    if (result.success) {
      searchResults.value = result.results
      if (result.results.length === 0) {
        searchError.value = '未找到匹配的城市'
      }
    } else {
      searchError.value = result.error || '搜索失败'
    }
  } catch (err) {
    searchError.value = '搜索请求失败'
    console.error('City search failed:', err)
  } finally {
    searching.value = false
  }
}

function selectCity(city: { name: string; id: string }) {
  location.value = city.id
  cityQuery.value = city.name
  searchResults.value = []
}

async function saveConfigSilent() {
  try {
    await window.api.invoke('config:set', {
      key: 'weather',
      value: {
        apiKey: apiKey.value,
        apiHost: apiHost.value,
        location: location.value,
        unit: 'metric'
      }
    })
  } catch (err) {
    console.error('Failed to save weather config:', err)
  }
}

async function saveConfig() {
  saving.value = true
  saved.value = false
  try {
    await saveConfigSilent()
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch (err) {
    console.error('Failed to save weather config:', err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>
