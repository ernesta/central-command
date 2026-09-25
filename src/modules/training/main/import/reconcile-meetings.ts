import { durationMinutes } from '@shared/time'
import { limitSkills, splitSkills, type InkpathRow } from './inkpath'

/** A meeting file, as far as reconciling needs it. */
export interface MeetingFileInfo {
  fileName: string
  date: string
  series: string
  start: string | null
  end: string | null
  skills: string[]
}

export interface ReconcilePatch {
  skills?: string[]
  start?: string
  end?: string
}

export type ReconcileItem =
  | {
      status: 'update'
      fileName: string
      source: string
      patch: ReconcilePatch
      /** Things worth knowing that did not change the file. */
      notes: string[]
    }
  | { status: 'ok'; fileName: string; source: string; notes: string[] }
  | { status: 'no-file'; source: string }

export interface ReconcilePlan {
  items: ReconcileItem[]
  /** Times that differ between the log and the file; the file's times are never overwritten. */
  timeDifferences: { fileName: string; file: string; log: string }[]
}

const seriesOfMeetingRow = (row: InkpathRow): string | null =>
  /^(supervisor|supervision) meeting\b/i.test(row.name)
    ? 'Supervision'
    : /\brastle lab\b/i.test(row.name)
      ? 'Rastle Lab'
      : null

const timeRange = (start: string | null, end: string | null): string =>
  start && end ? `${start}–${end}` : (start ?? end ?? 'no times')

/**
 * Compare the supervisor and lab meetings in the Inkpath log with the meeting files by date and series.
 * A file gets `skills` when it has none, and `start` and `end` when it has neither; anything else that
 * differs is reported and left alone. Nothing is ever overwritten.
 */
export function planReconcile(
  rows: readonly InkpathRow[],
  meetings: readonly MeetingFileInfo[]
): ReconcilePlan {
  const items: ReconcileItem[] = []
  const timeDifferences: ReconcilePlan['timeDifferences'] = []
  for (const row of rows) {
    const series = seriesOfMeetingRow(row)
    if (!series) continue
    const source = `row ${row.row}: ${row.name}`
    const matches = meetings.filter((m) => m.date === row.startDate && m.series === series)
    if (matches.length !== 1) {
      items.push({ status: 'no-file', source })
      continue
    }
    const file = matches[0]
    const patch: ReconcilePatch = {}
    const notes: string[] = []

    const { kept, extra } = limitSkills(splitSkills(row.skills).known)
    if (file.skills.length === 0 && kept.length > 0) patch.skills = kept
    else if (file.skills.length > 0 && JSON.stringify(file.skills) !== JSON.stringify(kept)) {
      notes.push(`skills differ: file has ${file.skills.join(', ')}; log has ${kept.join(', ')}`)
    }
    if (extra.length > 0)
      notes.push(`the log lists more than three skills; left out: ${extra.join(', ')}`)

    const logDuration = durationMinutes(row.startTime, row.endTime)
    if (row.startTime && row.endTime && logDuration !== null) {
      if (file.start === null && file.end === null) {
        patch.start = row.startTime
        patch.end = row.endTime
      } else if (file.start !== row.startTime || file.end !== row.endTime) {
        timeDifferences.push({
          fileName: file.fileName,
          file: timeRange(file.start, file.end),
          log: timeRange(row.startTime, row.endTime)
        })
      }
    }

    items.push(
      Object.keys(patch).length > 0
        ? { status: 'update', fileName: file.fileName, source, patch, notes }
        : { status: 'ok', fileName: file.fileName, source, notes }
    )
  }
  return { items, timeDifferences }
}
