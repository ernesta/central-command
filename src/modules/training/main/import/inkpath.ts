import { MAX_SKILLS, SKILLS } from '@shared/skills'

/** One activity of the Inkpath workbook, as far as the import needs it. Every value is the cell's text. */
export interface InkpathRow {
  /** The row number in the sheet (the header is row 1), for reports. */
  row: number
  name: string
  attendance: string
  description: string
  organisation: string
  provider: string
  /** YYYY-MM-DD, or '' when the cell is not a date. */
  startDate: string
  endDate: string
  /** HH:MM, or '' when missing. */
  startTime: string
  endTime: string
  /** The hours typed into Inkpath; not trusted (the app calculates from the times). */
  hours: number | null
  points: string
  /** The raw Skills cell. */
  skills: string
  notes: string
}

const REQUIRED = [
  'Name',
  'Attendance Type',
  'Description',
  'Organisation',
  'Provider',
  'Start Date',
  'Start Time',
  'End Date',
  'End Time',
  'Hours',
  'Points',
  'Skills'
]

/** `dd/mm/yyyy` (as Inkpath writes it) or an Excel serial number as YYYY-MM-DD; '' for anything else or an impossible date. */
export function parseInkpathDate(text: string): string {
  const t = text.trim()
  let year: number
  let month: number
  let day: number
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  if (dmy) {
    day = Number(dmy[1])
    month = Number(dmy[2])
    year = Number(dmy[3])
  } else if (/^\d{5}(\.\d+)?$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000)
    year = d.getUTCFullYear()
    month = d.getUTCMonth() + 1
    day = d.getUTCDate()
  } else return ''
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** `11:00:00`, `11:00` or an Excel day fraction as HH:MM; '' otherwise (seconds are dropped). */
export function parseInkpathTime(text: string): string {
  const t = text.trim()
  const hm = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t)
  if (hm) {
    const h = Number(hm[1])
    const m = Number(hm[2])
    return h <= 23 && m <= 59 ? `${String(h).padStart(2, '0')}:${hm[2]}` : ''
  }
  if (/^0?\.\d+$/.test(t)) {
    const minutes = Math.round(Number(t) * 24 * 60)
    return minutes < 24 * 60
      ? `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
      : ''
  }
  return ''
}

export interface ParsedWorkbook {
  rows: InkpathRow[]
  /** Problems that stop the import (a column is missing). */
  problems: string[]
}

/** The workbook's rows (as text, header first) as activities. Columns are found by their header names. */
export function parseInkpathRows(table: readonly (readonly string[])[]): ParsedWorkbook {
  const header = (table[0] ?? []).map((h) => h.trim())
  const missing = REQUIRED.filter((name) => !header.includes(name))
  if (missing.length > 0) {
    return {
      rows: [],
      problems: [`The workbook has no ${missing.map((m) => `"${m}"`).join(', ')} column`]
    }
  }
  const col = (name: string): number => header.indexOf(name)
  const rows: InkpathRow[] = []
  table.slice(1).forEach((cells, i) => {
    const cell = (name: string): string => (cells[col(name)] ?? '').replace(/\r\n?/g, '\n')
    if (cells.every((c) => !c || c.trim() === '')) return
    const hours = cell('Hours').trim()
    rows.push({
      row: i + 2,
      name: cell('Name').trim(),
      attendance: cell('Attendance Type').trim(),
      description: cell('Description').trim(),
      organisation: cell('Organisation').trim(),
      provider: cell('Provider').trim(),
      startDate: parseInkpathDate(cell('Start Date')),
      endDate: parseInkpathDate(cell('End Date')),
      startTime: parseInkpathTime(cell('Start Time')),
      endTime: parseInkpathTime(cell('End Time')),
      hours: hours !== '' && Number.isFinite(Number(hours)) ? Number(hours) : null,
      points: cell('Points').trim(),
      skills: cell('Skills').trim(),
      notes: cell('Notes').trim()
    })
  })
  return { rows, problems: [] }
}

export interface SkillSplit {
  /** The app's names for the skills found, in the order written (each once). */
  known: string[]
  /** Text in the cell that is not one of the known skills. */
  unknown: string[]
}

/**
 * The skills in an Inkpath Skills cell (a comma-separated list). Known skills are matched by their exact
 * Inkpath name, case-insensitively, so a name that itself contains a comma still matches; whatever is left
 * is unknown and is never invented into a skill.
 */
export function splitSkills(cell: string): SkillSplit {
  let rest = cell.trim()
  const found: { at: number; name: string }[] = []
  // Longest names first, so a name that contains another is not cut short.
  for (const skill of [...SKILLS].sort((a, b) => b.inkpath.length - a.inkpath.length)) {
    const lower = rest.toLowerCase()
    const at = lower.indexOf(skill.inkpath.toLowerCase())
    if (at === -1) continue
    found.push({ at, name: skill.name })
    rest =
      rest.slice(0, at) +
      '\uE000'.repeat(skill.inkpath.length) +
      rest.slice(at + skill.inkpath.length)
  }
  const unknown = rest
    .split(/\uE000+/)
    .flatMap((part) => part.split(','))
    .map((s) => s.trim())
    .filter(Boolean)
  const known = found.sort((a, b) => a.at - b.at).map((f) => f.name)
  return { known: [...new Set(known)], unknown }
}

/** Skills kept for an entry (the first three) and the ones that did not fit. */
export function limitSkills(known: readonly string[]): { kept: string[]; extra: string[] } {
  return { kept: known.slice(0, MAX_SKILLS), extra: known.slice(MAX_SKILLS) }
}

/** Supervisor and lab meetings belong to Meetings, not Training. */
export function isMeetingRow(row: Pick<InkpathRow, 'name'>): boolean {
  return /^(supervisor|supervision) meeting\b/i.test(row.name) || /\brastle lab\b/i.test(row.name)
}

/** The series an activity belongs to, or null: DataCamp by provider or title prefix, else SEDarc by organisation. */
export function seriesOfRow(
  row: Pick<InkpathRow, 'name' | 'provider' | 'organisation'>
): string | null {
  if (/^datacamp\b/i.test(row.provider) || /^datacamp\b/i.test(row.name)) return 'DataCamp'
  if (/^sedarc\b/i.test(row.organisation)) return 'SEDarc'
  return null
}

const INSTITUTION_WORDS =
  /\b(universit|college|school|institute|centre|center|department|royal holloway|datacamp|coursera|edx|mitx|lse|ucl|kcl|epigeum|society|association|forum|programme|program|academy|council|trust|network|hub|inc|ltd|group|lab|training|service|library|hospital|nhs|aston|reading|middlesex|oxford|cambridge|essex|sussex|senss|sedarc)\b/i

/** A Provider that looks like a person (a title and a name, or two capitalised words with no institution word). A guess, only used to report. */
export function looksLikePerson(provider: string): boolean {
  const p = provider.trim()
  if (!p || INSTITUTION_WORDS.test(p)) return false
  if (/^(dr|prof|professor|mr|mrs|ms|miss|mx|sir|dame)\.?\s+\p{Lu}/u.test(p)) return true
  return /^\p{Lu}[\p{L}'’-]+(\s+\p{Lu}[\p{L}'’-]+){1,2}$/u.test(p)
}
