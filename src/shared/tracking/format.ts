/** "7:45", "1,523:30", "−2:30": minutes as hours and minutes, never decimals. Fractions are rounded to the nearest minute. */
export function formatHours(totalMinutes: number): string {
  const rounded = Math.round(Math.abs(totalMinutes))
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60
  const sign = totalMinutes < 0 && rounded > 0 ? '−' : ''
  return `${sign}${hours.toLocaleString('en-US')}:${String(minutes).padStart(2, '0')}`
}

/** A balance: "+2:30", "−2:30", and "0:00" when there is none. */
export function formatSignedHours(totalMinutes: number): string {
  const text = formatHours(totalMinutes)
  return totalMinutes > 0 && text !== '0:00' ? `+${text}` : text
}

/**
 * Typed time as minutes: "7:45", "7", "0:15", or decimal hours ("1.5"). Null for anything else, and for a
 * negative or absurd value. The caller decides whether it must be a multiple of 15.
 */
export function parseHours(text: string): number | null {
  const t = text.trim().replace(',', '.')
  const hm = /^(\d{1,3}):([0-5]\d)$/.exec(t)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  if (/^\d{1,3}(\.\d{1,2})?$/.test(t)) return Math.round(Number(t) * 60)
  return null
}
