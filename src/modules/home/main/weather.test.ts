import { describe, expect, it } from 'vitest'
import type { Fetcher } from '../../watch/main/checker'
import {
  describeWeather,
  forecastUrl,
  parseForecast,
  WEATHER_CACHE_MS,
  WeatherService,
  type WeatherQuery
} from './weather'

const FORECAST = JSON.stringify({
  current: {
    time: '2026-10-15T09:15',
    temperature_2m: 17.6,
    apparent_temperature: 17.3,
    weather_code: 3,
    wind_speed_10m: 14.8
  },
  daily: {
    time: ['2026-10-15', '2026-10-16', '2026-10-17'],
    weather_code: [51, 55, 2],
    temperature_2m_max: [20.4, 16.4, 14.6],
    temperature_2m_min: [14.6, 10.3, 8.1],
    precipitation_probability_max: [2, 92, null]
  }
})

const query: WeatherQuery = { place: 'Egham', latitude: 51.4, longitude: -0.5, unit: 'celsius' }

function fetcher(body: string, status = 200): { f: Fetcher; urls: string[] } {
  const urls: string[] = []
  return {
    urls,
    f: async (url) => {
      urls.push(url)
      return { status, headers: { get: () => null }, text: async () => body }
    }
  }
}

describe('parseForecast', () => {
  it('reads now and three days, rounded, in words', () => {
    const w = parseForecast(FORECAST, 'Egham', 'celsius', '2026-10-15T09:00:00.000Z')
    expect(w.now).toEqual({
      temperature: 18,
      feelsLike: 17,
      code: 3,
      description: 'Overcast',
      windKph: 15
    })
    expect(w.days).toEqual([
      { date: '2026-10-15', code: 51, description: 'Drizzle', high: 20, low: 15, rainChance: 2 },
      { date: '2026-10-16', code: 55, description: 'Drizzle', high: 16, low: 10, rainChance: 92 },
      { date: '2026-10-17', code: 2, description: 'Partly cloudy', high: 15, low: 8, rainChance: 0 }
    ])
  })

  it('refuses an answer that is not a forecast', () => {
    expect(() => parseForecast('nope', 'x', 'celsius', '')).toThrow('unreadable')
    expect(() => parseForecast('{"error":true}', 'x', 'celsius', '')).toThrow('unexpected')
  })

  it('describes an unknown code', () => {
    expect(describeWeather(999)).toBe('Unknown')
    expect(describeWeather(95)).toBe('Thunderstorm')
  })
})

describe('what is sent', () => {
  it('the forecast address holds only rounded coordinates and settings, nothing about the user', () => {
    const url = new URL(forecastUrl(51.4, -0.5, 'fahrenheit'))
    expect(url.host).toBe('api.open-meteo.com')
    expect([...url.searchParams.keys()].sort()).toEqual(
      [
        'current',
        'daily',
        'forecast_days',
        'latitude',
        'longitude',
        'temperature_unit',
        'timezone'
      ].sort()
    )
    expect(url.searchParams.get('latitude')).toBe('51.4')
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit')
  })
})

describe('WeatherService', () => {
  it('asks nothing without a position', async () => {
    const { f, urls } = fetcher(FORECAST)
    expect(await new WeatherService(f).read(null)).toBeNull()
    expect(urls).toEqual([])
  })

  it('reuses a reading for half an hour, then asks again', async () => {
    let now = 1_000_000
    const { f, urls } = fetcher(FORECAST)
    const s = new WeatherService(f, () => now)
    await s.read(query)
    now += WEATHER_CACHE_MS - 1
    await s.read(query)
    expect(urls).toHaveLength(1)
    now += 2
    await s.read(query)
    expect(urls).toHaveLength(2)
  })

  it('asks again at once when the position or unit changed', async () => {
    const { f, urls } = fetcher(FORECAST)
    const s = new WeatherService(f, () => 5)
    await s.read(query)
    await s.read({ ...query, unit: 'fahrenheit' })
    expect(urls).toHaveLength(2)
  })

  it('keeps showing the last reading for a while when a request fails, then gives up', async () => {
    let now = 0
    let fail = false
    const f: Fetcher = async () => {
      if (fail) throw new Error('offline')
      return { status: 200, headers: { get: () => null }, text: async () => FORECAST }
    }
    const s = new WeatherService(f, () => now)
    const first = await s.read(query)
    fail = true
    now += WEATHER_CACHE_MS + 1
    expect(await s.read(query)).toBe(first)
    now += 6 * WEATHER_CACHE_MS
    await expect(s.read(query)).rejects.toThrow('offline')
  })

  it('treats a non-200 answer as an error', async () => {
    const s = new WeatherService(fetcher('', 500).f)
    await expect(s.read(query)).rejects.toThrow('answered 500')
  })
})
