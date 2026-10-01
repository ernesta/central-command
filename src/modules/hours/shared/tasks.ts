import { parseHours } from '@shared/tracking/format'
import { QUARTER } from '@shared/tracking/rounding'
import { sameLabel } from '@shared/tracking/timer'
import type { TrackingYear } from '@shared/tracking/types'

/**
 * The task names used in a year, the most recently used first, each once (names that match after trimming and
 * ignoring case are one task; the latest spelling wins). Suggested while typing a task name.
 */
export function earlierLabels(year: TrackingYear): string[] {
  const used = [
    ...year.sessions.map((s) => ({ label: s.label, at: `${s.date} ${s.start}` })),
    ...year.adjusts.map((a) => ({ label: a.label, at: `${a.date} 99:99:99` }))
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const labels: string[] = []
  for (const { label } of used) {
    const name = label.trim()
    if (name && !labels.some((l) => sameLabel(l, name))) labels.push(name)
  }
  return labels
}

/**
 * The earlier names that match what is being typed: those that start with it first, then those that contain it,
 * never the name already typed in full. Nothing is suggested before anything is typed.
 */
export function suggestLabels(labels: readonly string[], typed: string, limit = 6): string[] {
  const q = typed.trim().toLowerCase()
  if (!q) return []
  const rest = labels.filter((l) => l.toLowerCase() !== q && l.toLowerCase().includes(q))
  const starts = rest.filter((l) => l.toLowerCase().startsWith(q))
  return [...starts, ...rest.filter((l) => !starts.includes(l))].slice(0, limit)
}

/** Time typed for a task: "1:15", "2" or "1.25", in whole quarter hours. Null for anything else. */
export function parseQuarterHours(text: string): number | null {
  const minutes = parseHours(text)
  return minutes !== null && minutes % QUARTER === 0 ? minutes : null
}
