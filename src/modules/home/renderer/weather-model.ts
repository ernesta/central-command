import type { WeatherSummary } from '../shared/types'

export type WeatherIcon =
  'sun' | 'cloud-sun' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

/** The icon for a WMO weather code (the codes `describeWeather` names). */
export function weatherIcon(code: number): WeatherIcon {
  if (code === 0 || code === 1) return 'sun'
  if (code === 2) return 'cloud-sun'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95 && code <= 99) return 'storm'
  return 'cloud'
}

/** "18° Overcast · Egham" (the unit is shown only for Fahrenheit, as the degree sign alone reads as Celsius). */
export function weatherLine(w: WeatherSummary): { temperature: string; text: string } {
  const temperature = `${w.now.temperature}°${w.unit === 'fahrenheit' ? 'F' : ''}`
  return { temperature, text: [w.now.description, w.place].filter(Boolean).join(' · ') }
}
