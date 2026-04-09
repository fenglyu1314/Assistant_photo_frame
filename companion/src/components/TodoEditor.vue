<template>
  <div class="space-y-3">
    <h2 class="text-sm font-semibold text-slate-300">待办事项</h2>

    <!-- Add Todo -->
    <div class="flex gap-2">
      <input
        v-model="newTodoText"
        @keydown.enter="addTodo"
        placeholder="添加待办..."
        class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
      />
      <button
        @click="addTodo"
        :disabled="!newTodoText.trim()"
        class="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        添加
      </button>
    </div>

    <!-- Todo List -->
    <div class="space-y-1 max-h-40 overflow-y-auto">
      <div v-if="todos.length === 0" class="text-xs text-slate-500 text-center py-3">
        暂无待办事项
      </div>
      <div
        v-for="todo in todos"
        :key="todo.id"
        class="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-slate-800/50"
      >
        <input
          type="checkbox"
          :checked="todo.done"
          @change="toggleTodo(todo.id)"
          class="w-3.5 h-3.5 rounded border-slate-500 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
        />
        <span
          class="flex-1 text-xs"
          :class="todo.done ? 'line-through text-slate-500' : 'text-slate-300'"
        >
          {{ todo.text }}
        </span>
        <button
          @click="removeTodo(todo.id)"
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

interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: string
}

const todos = ref<TodoItem[]>([])
const newTodoText = ref('')

async function loadTodos() {
  try {
    const result = await window.api.invoke('data:get-todos') as TodoItem[]
    todos.value = result
  } catch (err) {
    console.error('Failed to load todos:', err)
  }
}

async function addTodo() {
  const text = newTodoText.value.trim()
  if (!text) return
  try {
    const newTodo = await window.api.invoke('data:add-todo', { text }) as TodoItem
    todos.value.push(newTodo)
    newTodoText.value = ''
  } catch (err) {
    console.error('Failed to add todo:', err)
  }
}

async function toggleTodo(id: string) {
  try {
    const updated = await window.api.invoke('data:toggle-todo', { id }) as TodoItem | { success: false; error: string }
    if ('success' in updated && !updated.success) return
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx >= 0) {
      todos.value[idx] = updated as TodoItem
    }
  } catch (err) {
    console.error('Failed to toggle todo:', err)
  }
}

async function removeTodo(id: string) {
  try {
    const result = await window.api.invoke('data:remove-todo', { id }) as { success: boolean }
    if (result.success) {
      todos.value = todos.value.filter(t => t.id !== id)
    }
  } catch (err) {
    console.error('Failed to remove todo:', err)
  }
}

onMounted(() => {
  loadTodos()
})
</script>
