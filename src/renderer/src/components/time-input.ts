import { normaliseTime } from '@shared/front-matter'

/** "9:30", "09:30", "930" and "0930" all read as 09:30; anything else is not a time. */
export function parseTime(raw: string): string | null {
  const text = raw.trim()
  const compact = /^(\d{1,2})(\d{2})$/.exec(text)
  return normaliseTime(compact ? `${compact[1]}:${compact[2]}` : text)
}

/**
 * The time after one Up or Down press: hours move by one, minutes by fifteen, each wrapping round without carrying into
 * the other. `part` is the part the cursor is in; an empty time starts at 09:00.
 */
export function stepTime(value: string, part: 'hours' | 'minutes', direction: 1 | -1): string {
  const [h, m] = (parseTime(value) ?? '09:00').split(':').map(Number)
  const hours = part === 'hours' ? (h + direction + 24) % 24 : h
  const minutes = part === 'minutes' ? (m + direction * 15 + 60) % 60 : m
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
