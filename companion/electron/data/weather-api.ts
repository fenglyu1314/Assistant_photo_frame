/**
 * QWeather API Client
 *
 * Wraps QWeather (和风天气) API for current weather, 3-day forecast,
 * and city search (GeoAPI).
 *
 * IMPORTANT: QWeather has deprecated the public API hosts (devapi.qweather.com,
 * api.qweather.com). Users must configure their own API Host from the
 * QWeather console (Settings → API Host).
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

export interface CityResult {
  name: string        // City name
  id: string          // LocationID (e.g. '101280601')
  lat: string         // Latitude
  lon: string         // Longitude
  adm1: string        // Province/State
  adm2: string        // City/District
  country: string     // Country
}

// ============================================================================
// Constants
// ============================================================================

const TIMEOUT_MS = 10_000

// ============================================================================
// Internal helpers
// ============================================================================

function buildBaseUrl(apiHost: string): string {
  // Ensure the host has https:// prefix
  const host = apiHost.trim()
  if (host.startsWith('https://')) return host
  if (host.startsWith('http://')) return host.replace('http://', 'https://')
  return `https://${host}`
}

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
   * @param apiHost  QWeather API Host (e.g. abc123.def.qweatherapi.com)
   */
  async getCurrent(location: string, apiKey: string, apiHost: string): Promise<CurrentWeather> {
    const base = buildBaseUrl(apiHost)
    const url = `${base}/v7/weather/now?location=${encodeURIComponent(location)}&key=${encodeURIComponent(apiKey)}`
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
   * @param apiHost  QWeather API Host
   */
  async getForecast(location: string, apiKey: string, apiHost: string): Promise<ForecastDay[]> {
    const base = buildBaseUrl(apiHost)
    const url = `${base}/v7/weather/3d?location=${encodeURIComponent(location)}&key=${encodeURIComponent(apiKey)}`
    const data = await fetchWithTimeout(url)

    return data.daily.map((day: any) => ({
      date: day.fxDate,
      tempMin: day.tempMin,
      tempMax: day.tempMax,
      textDay: day.textDay,
      iconDay: day.iconDay,
      textNight: day.textNight
    }))
  },

  /**
   * Search cities by name (supports Chinese, English, coordinates).
   * Uses QWeather GeoAPI: /geo/v2/city/lookup
   * @param query  City name (e.g. "深圳", "Beijing") or coordinates
   * @param apiKey QWeather API key
   * @param apiHost QWeather API Host
   */
  async searchCity(query: string, apiKey: string, apiHost: string): Promise<CityResult[]> {
    const base = buildBaseUrl(apiHost)
    const url = `${base}/geo/v2/city/lookup?location=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}&number=5&range=cn`
    const data = await fetchWithTimeout(url)

    if (!data.location || !Array.isArray(data.location)) {
      return []
    }

    return data.location.map((city: any) => ({
      name: city.name,
      id: city.id,
      lat: city.lat,
      lon: city.lon,
      adm1: city.adm1,
      adm2: city.adm2,
      country: city.country
    }))
  }
}
