import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    globals: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
