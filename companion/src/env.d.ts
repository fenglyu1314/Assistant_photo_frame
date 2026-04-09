/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare const __APP_VERSION__: string

interface Window {
  api: {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
    send: (channel: string, ...args: unknown[]) => void
    on: (channel: string, callback: (...args: unknown[]) => void) => void
    off: (channel: string, callback: (...args: unknown[]) => void) => void
  }
}
