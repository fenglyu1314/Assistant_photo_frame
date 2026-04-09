/**
 * Data Manager - Aggregates all dashboard data
 *
 * Manages todos, calendar events, and collects weather + datetime
 * into a unified DashboardData object for template rendering.
 */

import { ConfigStore, type TodoItem, type CalendarEvent } from './config-store'
import { WeatherApi, type CurrentWeather, type ForecastDay } from './weather-api'
import { randomUUID } from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface WeatherData {
  current: CurrentWeather
  forecast: ForecastDay[]
}

export interface DateTimeData {
  date: string       // YYYY-MM-DD
  time: string       // HH:mm
  weekday: string    // 中文星期
  year: number
  month: number
  day: number
}

export interface DashboardData {
  todos: TodoItem[]
  events: CalendarEvent[]
  weather: WeatherData | null
  dateTime: DateTimeData
}

// ============================================================================
// Weekday helper
// ============================================================================

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function getDateTimeData(): DateTimeData {
  const now = new Date()
  return {
    date: now.toISOString().split('T')[0],
    time: now.toTimeString().slice(0, 5),
    weekday: WEEKDAYS[now.getDay()],
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  }
}

// ============================================================================
// DataManager
// ============================================================================

export class DataManager {
  // --------------------------------------------------------------------------
  // Todo CRUD
  // --------------------------------------------------------------------------

  async getTodos(): Promise<TodoItem[]> {
    return ConfigStore.get('todos')
  }

  async addTodo(text: string): Promise<TodoItem> {
    const todos = await this.getTodos()
    const newTodo: TodoItem = {
      id: randomUUID(),
      text,
      done: false,
      createdAt: new Date().toISOString()
    }
    todos.push(newTodo)
    await ConfigStore.set('todos', todos)
    return newTodo
  }

  async toggleTodo(id: string): Promise<TodoItem | null> {
    const todos = await this.getTodos()
    const todo = todos.find(t => t.id === id)
    if (!todo) return null
    todo.done = !todo.done
    await ConfigStore.set('todos', todos)
    return todo
  }

  async removeTodo(id: string): Promise<boolean> {
    const todos = await this.getTodos()
    const idx = todos.findIndex(t => t.id === id)
    if (idx === -1) return false
    todos.splice(idx, 1)
    await ConfigStore.set('todos', todos)
    return true
  }

  // --------------------------------------------------------------------------
  // Event CRUD
  // --------------------------------------------------------------------------

  async getEvents(): Promise<CalendarEvent[]> {
    return ConfigStore.get('events')
  }

  async addEvent(title: string, date: string, time?: string): Promise<CalendarEvent> {
    const events = await this.getEvents()
    const newEvent: CalendarEvent = {
      id: randomUUID(),
      title,
      date,
      time,
      createdAt: new Date().toISOString()
    }
    events.push(newEvent)
    await ConfigStore.set('events', events)
    return newEvent
  }

  async removeEvent(id: string): Promise<boolean> {
    const events = await this.getEvents()
    const idx = events.findIndex(e => e.id === id)
    if (idx === -1) return false
    events.splice(idx, 1)
    await ConfigStore.set('events', events)
    return true
  }

  async getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    const events = await this.getEvents()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + days)

    return events
      .filter(e => {
        const eventDate = new Date(e.date)
        return eventDate >= today && eventDate <= endDate
      })
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return (a.time || '').localeCompare(b.time || '')
      })
  }

  // --------------------------------------------------------------------------
  // Data collection (aggregation)
  // --------------------------------------------------------------------------

  /**
   * Collect all dashboard data. Weather failure degrades to null.
   */
  async collect(): Promise<DashboardData> {
    const [todos, events, weather] = await Promise.all([
      this.getTodos(),
      this.getUpcomingEvents(),
      this.fetchWeatherSafe()
    ])

    return {
      todos,
      events,
      weather,
      dateTime: getDateTimeData()
    }
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  private async fetchWeatherSafe(): Promise<WeatherData | null> {
    try {
      const weatherConfig = await ConfigStore.get('weather')
      if (!weatherConfig.apiKey || !weatherConfig.location) {
        return null
      }

      const [current, forecast] = await Promise.all([
        WeatherApi.getCurrent(weatherConfig.location, weatherConfig.apiKey),
        WeatherApi.getForecast(weatherConfig.location, weatherConfig.apiKey)
      ])

      return { current, forecast }
    } catch (err) {
      console.warn('[DataManager] Weather fetch failed:', err instanceof Error ? err.message : err)
      return null
    }
  }
}
