import { normaliseTime } from '@shared/front-matter'
import { QUARTER } from '@shared/tracking/rounding'

/** A time on the nearest quarter hour (09:07 is 09:00, 09:08 is 09:15); the day's last quarter is 23:45. */
export function snapTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total = Math.min(23 * 60 + 45, Math.floor((h * 60 + m + QUARTER / 2) / QUARTER) * QUARTER)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** "9:30", "09:30", "930" and "0930" all read as 09:30; anything else is not a time. */
export function parseTime(raw: string): string | null {
  const text = raw.trim()
  const compact = /^(\d{1,2})(\d{2})$/.exec(text)
  return normaliseTime(compact ? `${compact[1]}:${compact[2]}` : text)
}

/** Typed or pasted text as a time on a quarter hour, or null when it is not a time. */
export function parseQuarterTime(raw: string): string | null {
  const time = parseTime(raw)
  return time && snapTime(time)
}

/**
 * The time after one Up or Down press: hours move by one, minutes by fifteen, each wrapping round without carrying into
 * the other. `part` is the part the cursor is in; an empty time starts at 09:00.
 */
export function stepTime(value: string, part: 'hours' | 'minutes', direction: 1 | -1): string {
  const [h, m] = (parseTime(value) ?? '09:00').split(':').map(Number)
  const hours = part === 'hours' ? (h + direction + 24) % 24 : h
  const minutes = part === 'minutes' ? (m + direction * 15 + 60) % 60 : m
  return snapTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
}

const addHour = (time: string): string => {
  const [h, m] = time.split(':').map(Number)
  return h >= 23 ? '23:45' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * The end after the start changes: an empty end, or one still sitting an hour after the old start (so it was filled in
 * by this rule and the start is still being typed), follows the new start by an hour, since most meetings and trainings
 * take one. An end the user set differently is left alone.
 */
export function endFollowingStart(
  oldStart: string | null,
  newStart: string | null,
  end: string | null
): string | null {
  if (!newStart) return end
  const untouched = !end || (oldStart !== null && end === addHour(oldStart))
  return untouched ? addHour(newStart) : end
}
