import { describe, expect, it } from 'vitest'
import type { WeatherSettings } from '@shared/home-settings'
import type { Fetcher } from '../../watch/main/checker'
import {
  describeWeather,
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parsePlaces,
  WEATHER_CACHE_MS,
  WeatherService
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

const settings: WeatherSettings = {
  enabled: true,
  place: 'Egham',
  latitude: 51.4,
  longitude: -0.5,
  unit: 'celsius'
}

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

  it('the place search holds only the name', () => {
    const url = new URL(geocodeUrl('  Egham  '))
    expect(url.searchParams.get('name')).toBe('Egham')
    expect(url.host).toBe('geocoding-api.open-meteo.com')
  })
})

describe('parsePlaces', () => {
  it('gives candidates with town-level coordinates and skips broken rows', () => {
    const json = JSON.stringify({
      results: [
        {
          name: 'Egham',
          admin1: 'England',
          country: 'United Kingdom',
          latitude: 51.43123,
          longitude: -0.55987
        },
        { name: 'No coordinates' },
        { admin1: 'No name', latitude: 1, longitude: 2 }
      ]
    })
    expect(parsePlaces(json)).toEqual([
      {
        name: 'Egham',
        region: 'England',
        country: 'United Kingdom',
        latitude: 51.4,
        longitude: -0.6
      }
    ])
    expect(parsePlaces('{}')).toEqual([])
  })

  it('lists two places that round to the same town once', () => {
    const row = { name: 'Egham', admin1: 'North West', country: 'South Africa' }
    const json = JSON.stringify({
      results: [
        { ...row, latitude: -25.512, longitude: 25.704 },
        { ...row, latitude: -25.49, longitude: 25.71 },
        { ...row, latitude: -26.5, longitude: 25.7 }
      ]
    })
    expect(parsePlaces(json).map((p) => [p.latitude, p.longitude])).toEqual([
      [-25.5, 25.7],
      [-26.5, 25.7]
    ])
  })
})

describe('WeatherService', () => {
  it('asks nothing while off or without a place', async () => {
    const { f, urls } = fetcher(FORECAST)
    const s = new WeatherService(f)
    expect(await s.read({ ...settings, enabled: false })).toBeNull()
    expect(await s.read({ ...settings, latitude: null })).toBeNull()
    expect(urls).toEqual([])
  })

  it('reuses a reading for half an hour, then asks again', async () => {
    let now = 1_000_000
    const { f, urls } = fetcher(FORECAST)
    const s = new WeatherService(f, () => now)
    await s.read(settings)
    now += WEATHER_CACHE_MS - 1
    await s.read(settings)
    expect(urls).toHaveLength(1)
    now += 2
    await s.read(settings)
    expect(urls).toHaveLength(2)
  })

  it('asks again at once when the place or unit changed', async () => {
    const { f, urls } = fetcher(FORECAST)
    const s = new WeatherService(f, () => 5)
    await s.read(settings)
    await s.read({ ...settings, unit: 'fahrenheit' })
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
    const first = await s.read(settings)
    fail = true
    now += WEATHER_CACHE_MS + 1
    expect(await s.read(settings)).toBe(first)
    now += 6 * WEATHER_CACHE_MS
    await expect(s.read(settings)).rejects.toThrow('offline')
  })

  it('treats a non-200 answer as an error', async () => {
    const s = new WeatherService(fetcher('', 500).f)
    await expect(s.read(settings)).rejects.toThrow('answered 500')
  })

  it('does not search for a place name that is too short', async () => {
    const { f, urls } = fetcher('{}')
    expect(await new WeatherService(f).findPlace(' x ')).toEqual([])
    expect(urls).toEqual([])
  })
})
