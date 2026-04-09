import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@core': resolve('src/core')
      }
    },
    build: {
      lib: {
        entry: resolve('electron/main.ts')
      },
      externalizeDeps: true,
      rollupOptions: {
        external: ['serialport', 'electron-store']
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve('electron/preload.ts')
      },
      externalizeDeps: true
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: resolve('index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    plugins: [vue(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    }
  }
})
