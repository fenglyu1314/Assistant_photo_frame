/**
 * QWeather API Client
 *
 * Wraps QWeather (和风天气) free API for current weather and 3-day forecast.
 * Uses Node.js native fetch with 10s timeout.
 *
 * API docs: https://dev.qweather.com/docs/api/
 */

// ============================================================================
// Types
// ============================================================================

export interface CurrentWeather {
  temp: string        // Temperature (°C)
  text: string        // Weather text description
  icon: string        // QWeather icon code
  humidity: string    // Humidity %
  windDir: string     // Wind direction
  windScale: string   // Wind scale
}

export interface ForecastDay {
  date: string        // YYYY-MM-DD
  tempMin: string     // Min temperature
  tempMax: string     // Max temperature
  textDay: string     // Day weather text
  iconDay: string     // Day icon code
  textNight: string   // Night weather text
}

// ============================================================================
// Constants
// ============================================================================

const BASE_URL = 'https://devapi.qweather.com'
const TIMEOUT_MS = 10_000

// ============================================================================
// Internal helpers
// ============================================================================

async function fetchWithTimeout(url: string): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const data = await response.json()
    if (data.code !== '200') {
      throw new Error(`QWeather API error: code=${data.code}`)
    }
    return data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('QWeather API timeout (10s)')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================================
// Public API
// ============================================================================

export const WeatherApi = {
  /**
   * Get current weather for a location.
   * @param location QWeather location ID or "lon,lat"
   * @param apiKey   QWeather API key
   */
  async getCurrent(location: string, apiKey: string): Promise<CurrentWeather> {
    const url = `${BASE_URL}/v7/weather/now?location=${encodeURIComponent(location)}&key=${encodeURIComponent(apiKey)}`
    const data = await fetchWithTimeout(url)
    const now = data.now

    return {
      temp: now.temp,
      text: now.text,
      icon: now.icon,
      humidity: now.humidity,
      windDir: now.windDir,
      windScale: now.windScale
    }
  },

  /**
   * Get 3-day weather forecast for a location.
   * @param location QWeather location ID or "lon,lat"
   * @param apiKey   QWeather API key
   */
  async getForecast(location: string, apiKey: string): Promise<ForecastDay[]> {
    const url = `${BASE_URL}/v7/weather/3d?location=${encodeURIComponent(location)}&key=${encodeURIComponent(apiKey)}`
    const data = await fetchWithTimeout(url)

    return data.daily.map((day: any) => ({
      date: day.fxDate,
      tempMin: day.tempMin,
      tempMax: day.tempMax,
      textDay: day.textDay,
      iconDay: day.iconDay,
      textNight: day.textNight
    }))
  }
}
