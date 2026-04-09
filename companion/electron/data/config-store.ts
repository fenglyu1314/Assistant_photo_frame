/**
 * Configuration Store - Persistent app config using electron-store
 *
 * Stores user preferences, todo items, calendar events, and weather config.
 * Uses JSON file at app.getPath('userData')/config.json.
 */

// ============================================================================
// Types
// ============================================================================

export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: string // ISO 8601
}

export interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  time?: string // HH:mm
  createdAt: string // ISO 8601
}

export interface WeatherConfig {
  apiKey: string
  apiHost: string  // QWeather API Host (e.g. abc123.def.qweatherapi.com)
  location: string // QWeather city/location ID
  unit: 'metric'
}

export interface RefreshConfig {
  intervalMinutes: number
}

export interface AppConfig {
  weather: WeatherConfig
  refresh: RefreshConfig
  todos: TodoItem[]
  events: CalendarEvent[]
}

// ============================================================================
// Schema & Defaults
// ============================================================================

const CONFIG_DEFAULTS: AppConfig = {
  weather: {
    apiKey: '',
    apiHost: '',
    location: '',
    unit: 'metric'
  },
  refresh: {
    intervalMinutes: 30
  },
  todos: [],
  events: []
}

// ============================================================================
// ConfigStore singleton (lazy-initialized)
// ============================================================================

/**
 * electron-store v11+ is ESM-only. We use dynamic import() to load it
 * from CJS-output main process code.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let storeInstance: any = null

async function getStore(): Promise<any> {
  if (storeInstance) return storeInstance
  // Dynamic import for ESM-only electron-store
  const { default: Store } = await import('electron-store')
  storeInstance = new Store<AppConfig>({
    name: 'config',
    defaults: CONFIG_DEFAULTS
  })
  return storeInstance
}

// ============================================================================
// Public API
// ============================================================================

export const ConfigStore = {
  /**
   * Initialize the store. Must be called once at startup (after app.whenReady).
   */
  async init(): Promise<void> {
    await getStore()
  },

  /**
   * Get a config value by dot-notation key.
   */
  async get<K extends keyof AppConfig>(key: K): Promise<AppConfig[K]> {
    const store = await getStore()
    return store.get(key)
  },

  /**
   * Set a config value by dot-notation key.
   */
  async set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): Promise<void> {
    const store = await getStore()
    store.set(key, value)
  },

  /**
   * Get entire config object.
   */
  async getAll(): Promise<AppConfig> {
    const store = await getStore()
    return store.store as AppConfig
  },

  /**
   * Get raw store for direct access (advanced usage).
   */
  async getStore(): Promise<any> {
    return getStore()
  }
}
