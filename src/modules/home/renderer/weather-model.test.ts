import { describe, expect, it } from 'vitest'
import type { WeatherSummary } from '../shared/types'
import { weatherIcon, weatherLine } from './weather-model'

const summary = (unit: 'celsius' | 'fahrenheit', place = 'Egham'): WeatherSummary => ({
  place,
  unit,
  at: '2026-10-18T12:00:00Z',
  now: { temperature: 18, feelsLike: 17, code: 3, description: 'Overcast', windKph: 15 },
  days: []
})

describe('weatherIcon', () => {
  it.each([
    [0, 'sun'],
    [2, 'cloud-sun'],
    [3, 'cloud'],
    [45, 'fog'],
    [53, 'drizzle'],
    [63, 'rain'],
    [81, 'rain'],
    [73, 'snow'],
    [86, 'snow'],
    [95, 'storm'],
    [99, 'storm'],
    [1234, 'cloud']
  ])('code %i is %s', (code, icon) => expect(weatherIcon(code)).toBe(icon))
})

describe('weatherLine', () => {
  it('reads like the date beside it', () => {
    expect(weatherLine(summary('celsius'))).toEqual({
      temperature: '18°',
      text: 'Overcast · Egham'
    })
  })
  it('names Fahrenheit and copes with no place', () => {
    expect(weatherLine(summary('fahrenheit', ''))).toEqual({
      temperature: '18°F',
      text: 'Overcast'
    })
  })
})
