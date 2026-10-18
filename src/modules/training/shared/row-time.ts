import { durationMinutes, formatDuration } from '@shared/time'

/** "3 h + 1 h 15 min self-study": a duration with its self-study after it (nothing added when there is none). */
export function durationWithStudy(minutes: number, selfStudy = 0): string {
  return selfStudy > 0
    ? `${formatDuration(minutes)} + ${formatDuration(selfStudy)} self-study`
    : formatDuration(minutes)
}

/** The parts of a row's time line, in the order they are shown. A part that is missing is null, never an empty string. */
export interface RowTimeParts {
  /** "09:30–15:00"; just the start ("14:00") when only that is known; "No time yet" otherwise (an end alone is no time). */
  range: string
  /** "5 h 30 min", or null when there is no duration. */
  duration: string | null
  /** "In person", or null when the row has no mode. */
  mode: string | null
}

/**
 * What every "recent and upcoming" row says about when and how, upcoming or past, training or meeting: the range, the duration and
 * the type of attendance. An end without a start is no time; a start without an end shows the start. `minutes` is the row's total where it has
 * more than its session (a lecture's self-study); it defaults to the session's own length; `selfStudy` follows it as "+ … self-study".
 */
export function rowTimeParts(
  row: { start: string | null; end: string | null },
  modeLabel: string | null | undefined,
  minutes?: number | null,
  selfStudy = 0
): RowTimeParts {
  const session = durationMinutes(row.start, row.end)
  const total = minutes === undefined ? session : minutes
  return {
    range: session !== null ? `${row.start}–${row.end}` : (row.start ?? 'No time yet'),
    duration: total === null ? null : durationWithStudy(total, selfStudy),
    mode: modeLabel || null
  }
}

/** "09:30–15:00 · 5 h 30 min · In person". */
export function rowTimeLine(
  row: { start: string | null; end: string | null },
  modeLabel: string | null | undefined,
  minutes?: number | null,
  selfStudy = 0
): string {
  const { range, duration, mode } = rowTimeParts(row, modeLabel, minutes, selfStudy)
  return [range, duration, mode].filter((part): part is string => part !== null).join(' · ')
}
