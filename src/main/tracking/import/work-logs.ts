/**
 * Reading the user's monthly Work activity logs (Word files turned into plain text) for the totals they state. Each
 * states its period ("the four full weeks between March 4, 2026, and March 31, 2026"), lists activities with hours and
 * ends with a total; from May 2026 they have an Impact and a Teaching & Learning section (the section's total comes
 * first, then its lines) and a "Both teams" or "Total" line at the end. The wording of the lines is summarised, so only
 * totals can be reconciled with the sheet, not activities. A log whose own lines do not add up to its totals is a problem.
 */

export interface LogEntry {
  label: string
  minutes: number
  /** The section it sits in; null in the older logs, which have none. */
  client: 'Impact' | 'Teaching & Learning' | null
}

export interface ActivityLog {
  /** `2026-05`, from the file name. */
  month: string
  name: string
  from: string
  to: string
  entries: LogEntry[]
  /** The stated totals, in minutes (a section total is null where the log has no sections). */
  totals: { impact: number | null; teaching: number | null; total: number }
  problems: string[]
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
]

function monthNumber(name: string): number | null {
  const t = name.toLowerCase()
  const i = MONTHS.findIndex((m) => m === t || m.slice(0, 3) === t)
  return i < 0 ? null : i + 1
}

const iso = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** `3.25 h` (the older logs) or `3.25` under a "Time (h)" heading (from June 2026). */
/** Tabs and no-break spaces, which Word leaves in a cell. */
const SPACES = new RegExp('[\\u00a0\\t]+', 'g')
const HOURS = /^(\d+(?:\.\d+)?)(?:\s*h)?$/
const minutesOf = (hours: string): number => Math.round(Number(hours) * 60)

/** An activity log from its text. `name` is the file name without the extension (`2026 05 Activity Log`). */
export function parseActivityLog(name: string, text: string): ActivityLog {
  const problems: string[] = []
  const m = /^(\d{4}) (\d{2})\b/.exec(name)
  const month = m ? `${m[1]}-${m[2]}` : name
  if (!m) problems.push(`${name}: the file name does not start with a year and a month.`)

  const lines = text.split(/\r?\n/).map((l) => l.replace(SPACES, ' ').trim())
  let from = ''
  let to = ''
  const period =
    /between ([A-Za-z]+) (\d{1,2})(?:, (\d{4}))?,? and ([A-Za-z]+) (\d{1,2}), (\d{4})/.exec(text)
  if (period) {
    const m1 = monthNumber(period[1])
    const m2 = monthNumber(period[4])
    const endYear = Number(period[6])
    const startYear = period[3] ? Number(period[3]) : endYear
    if (m1 && m2) {
      from = iso(startYear, m1, Number(period[2]))
      to = iso(endYear, m2, Number(period[5]))
    }
  }
  if (!from || !to) problems.push(`${name}: no period ("between … and …") found.`)

  const entries: LogEntry[] = []
  const totals = { impact: null as number | null, teaching: null as number | null, total: -1 }
  let section: LogEntry['client'] = null
  let label = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === '') continue
    const total = /^(?:(Impact|Teaching (?:and|&) Learning|Both teams)\s*[–-]\s*)?Total$/i.exec(
      line
    )
    const hours = HOURS.exec(line)
    if (total) {
      const value = HOURS.exec(lines[i + 1] ?? '')
      if (!value) {
        problems.push(`${name}: "${line}" has no hours after it.`)
        continue
      }
      i++
      const which = (total[1] ?? '').toLowerCase()
      if (which === 'impact') {
        totals.impact = minutesOf(value[1])
        section = 'Impact'
      } else if (which.startsWith('teaching')) {
        totals.teaching = minutesOf(value[1])
        section = 'Teaching & Learning'
      } else {
        totals.total = minutesOf(value[1])
        section = null
      }
      label = ''
    } else if (hours) {
      if (label === '') problems.push(`${name}: hours "${line}" with no activity before them.`)
      else entries.push({ label, minutes: minutesOf(hours[1]), client: section })
      label = ''
    } else label = line
  }
  if (totals.total < 0) problems.push(`${name}: no total found.`)

  const sum = (client: LogEntry['client'] | 'all'): number =>
    entries
      .filter((e) => client === 'all' || e.client === client)
      .reduce((a, e) => a + e.minutes, 0)
  if (totals.impact !== null || totals.teaching !== null) {
    if (totals.impact !== null && sum('Impact') !== totals.impact)
      problems.push(
        `${name}: the Impact lines add up to ${sum('Impact')} min, its total says ${totals.impact}.`
      )
    if (totals.teaching !== null && sum('Teaching & Learning') !== totals.teaching)
      problems.push(
        `${name}: the Teaching & Learning lines add up to ${sum('Teaching & Learning')} min, its total says ${totals.teaching}.`
      )
    if (totals.total >= 0 && (totals.impact ?? 0) + (totals.teaching ?? 0) !== totals.total)
      problems.push(`${name}: the two sections do not add up to the total.`)
  } else if (totals.total >= 0 && sum('all') !== totals.total)
    problems.push(`${name}: the lines add up to ${sum('all')} min, the total says ${totals.total}.`)

  return { month, name, from, to, entries, totals, problems }
}
