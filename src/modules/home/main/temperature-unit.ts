import type { TemperatureUnit } from './weather'

/** Regions that use Fahrenheit day to day. */
const FAHRENHEIT_REGIONS = new Set(['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW'])

/**
 * The unit the Mac uses: the Temperature unit chosen in System Settings (`AppleTemperatureUnit`, written only once it was
 * changed) and otherwise the one the region uses.
 */
export function temperatureUnit(
  appleUnit: string | null,
  regionCode: string | null
): TemperatureUnit {
  const chosen = appleUnit?.trim().toLowerCase()
  if (chosen === 'fahrenheit') return 'fahrenheit'
  if (chosen === 'celsius') return 'celsius'
  return regionCode && FAHRENHEIT_REGIONS.has(regionCode.toUpperCase()) ? 'fahrenheit' : 'celsius'
}
