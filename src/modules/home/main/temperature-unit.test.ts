import { describe, expect, it } from 'vitest'
import { temperatureUnit } from './temperature-unit'

describe('temperatureUnit', () => {
  it('follows the unit chosen in System Settings, whatever the region', () => {
    expect(temperatureUnit('Fahrenheit\n', 'GB')).toBe('fahrenheit')
    expect(temperatureUnit('Celsius\n', 'US')).toBe('celsius')
  })
  it('follows the region when the Mac was never told', () => {
    expect(temperatureUnit(null, 'US')).toBe('fahrenheit')
    expect(temperatureUnit(null, 'us')).toBe('fahrenheit')
    expect(temperatureUnit(null, 'GB')).toBe('celsius')
    expect(temperatureUnit('', null)).toBe('celsius')
    expect(temperatureUnit('Kelvin', 'GB')).toBe('celsius')
  })
})
