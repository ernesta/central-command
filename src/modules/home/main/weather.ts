import type { Fetcher } from '../../watch/main/checker'
import type { WeatherSummary } from '../shared/types'

/** WMO weather codes, as Open-Meteo reports them, in words. */
const DESCRIPTIONS: [number[], string][] = [
  [[0], 'Clear'],
  [[1], 'Mostly clear'],
  [[2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55], 'Drizzle'],
  [[56, 57], 'Freezing drizzle'],
  [[61], 'Light rain'],
  [[63], 'Rain'],
  [[65], 'Heavy rain'],
  [[66, 67], 'Freezing rain'],
  [[71, 73, 75, 77], 'Snow'],
  [[80, 81], 'Showers'],
  [[82], 'Heavy showers'],
  [[85, 86], 'Snow showers'],
  [[95], 'Thunderstorm'],
  [[96, 99], 'Thunderstorm with hail']
]

export function describeWeather(code: number): string {
  return DESCRIPTIONS.find(([codes]) => codes.includes(code))?.[1] ?? 'Unknown'
}

/** How long a reading is reused: a weather service is asked at most every half hour. */
export const WEATHER_CACHE_MS = 30 * 60_000

const FORECAST = 'https://api.open-meteo.com/v1/forecast'

export type TemperatureUnit = 'celsius' | 'fahrenheit'

/** What the weather is asked for: a town's rounded position, in the unit the Mac uses; `place` is only shown, never sent. */
export interface WeatherQuery {
  place: string
  latitude: number
  longitude: number
  unit: TemperatureUnit
}

/**
 * The address asked for the weather. Only the rounded coordinates and the unit are in it: no name, no account, no
 * identifier. (Coordinates are rounded to a town by `parseLocation`; this is the one place they leave the app.)
 */
export function forecastUrl(latitude: number, longitude: number, unit: TemperatureUnit): string {
  const q = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: '3',
    timezone: 'auto',
    temperature_unit: unit
  })
  return `${FORECAST}?${q.toString()}`
}

interface ForecastJson {
  current?: {
    temperature_2m?: number
    apparent_temperature?: number
    weather_code?: number
    wind_speed_10m?: number
  }
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: (number | null)[]
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function parseForecast(
  json: string,
  place: string,
  unit: TemperatureUnit,
  at: string
): WeatherSummary {
  let data: ForecastJson
  try {
    data = JSON.parse(json) as ForecastJson
  } catch {
    throw new Error('The weather service sent something unreadable')
  }
  const c = data.current
  const d = data.daily
  const temperature = num(c?.temperature_2m)
  const code = num(c?.weather_code)
  if (temperature === null || code === null || !d?.time)
    throw new Error('The weather service sent something unexpected')
  const days = d.time.slice(0, 3).flatMap((date, i) => {
    const dayCode = num(d.weather_code?.[i])
    const high = num(d.temperature_2m_max?.[i])
    const low = num(d.temperature_2m_min?.[i])
    if (dayCode === null || high === null || low === null) return []
    return [
      {
        date,
        code: dayCode,
        description: describeWeather(dayCode),
        high: Math.round(high),
        low: Math.round(low),
        rainChance: Math.round(num(d.precipitation_probability_max?.[i]) ?? 0)
      }
    ]
  })
  return {
    place,
    unit,
    at,
    now: {
      temperature: Math.round(temperature),
      feelsLike: Math.round(num(c?.apparent_temperature) ?? temperature),
      code,
      description: describeWeather(code),
      windKph: Math.round(num(c?.wind_speed_10m) ?? 0)
    },
    days
  }
}

export class WeatherService {
  private cache: { key: string; at: number; summary: WeatherSummary } | null = null

  constructor(
    private readonly fetcher: Fetcher,
    private readonly clock: () => number = Date.now
  ) {}

  /** The weather for a position, or null when there is none. A failed request keeps the last reading for a while rather than blanking the page. */
  async read(query: WeatherQuery | null): Promise<WeatherSummary | null> {
    if (!query) return null
    const key = `${query.latitude},${query.longitude},${query.unit}`
    const now = this.clock()
    if (this.cache && this.cache.key === key && now - this.cache.at < WEATHER_CACHE_MS)
      return this.cache.summary
    try {
      const response = await this.fetcher(
        forecastUrl(query.latitude, query.longitude, query.unit),
        { headers: { Accept: 'application/json', 'User-Agent': 'CentralCommand/1.0' } }
      )
      if (response.status !== 200)
        throw new Error(`The weather service answered ${response.status}`)
      const summary = parseForecast(
        await response.text(),
        query.place,
        query.unit,
        new Date(now).toISOString()
      )
      this.cache = { key, at: now, summary }
      return summary
    } catch (error) {
      if (this.cache && this.cache.key === key && now - this.cache.at < 6 * WEATHER_CACHE_MS)
        return this.cache.summary
      throw error
    }
  }
}
