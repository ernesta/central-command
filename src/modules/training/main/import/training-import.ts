import { extractSection } from '@shared/sections'
import { durationMinutes } from '@shared/time'
import {
  parseTrainingMeta,
  splitNote,
  updateTrainingHead,
  type TrainingPatch
} from '../../shared/front-matter'
import { trainingBaseName } from '../file-name'
import {
  isMeetingRow,
  limitSkills,
  looksLikePerson,
  seriesOfRow,
  splitSkills,
  type InkpathRow
} from './inkpath'
import {
  linesOf,
  parseTrainingNote,
  titleWords,
  type ObsidianTrainingNote,
  type ParsedTrainingNote
} from './obsidian-notes'

/** A folder under the Trainings folder, as a path relative to it (`2025-26/SEDarc/2025 12 10 Title`). */
export interface TrainingFolder {
  path: string
}

export interface ExistingEntry {
  fileName: string
  date: string
  title: string
}

export interface ImportInput {
  rows: readonly InkpathRow[]
  notes?: readonly ObsidianTrainingNote[]
  folders?: readonly TrainingFolder[]
  existing: readonly ExistingEntry[]
}

export interface PlannedEntry {
  status: 'import'
  /** The file name to create. */
  target: string
  content: string
  source: string
  row: InkpathRow
  patch: TrainingPatch
  minutes: number | null
  notes: string[]
  /** What the user should look at later (an entry that broke a rule); for the report and the user's TODO list, not written to the file. */
  todo: string | null
  /** Names from the note's Lead line. */
  leads: string[]
  matchedNote: string | null
}

export type ImportItem =
  | PlannedEntry
  | { status: 'skip-exists'; source: string; reason: string }
  | { status: 'attention'; source: string; problems: string[] }

export interface ImportPlan {
  items: ImportItem[]
  /** Supervisor and lab meetings, left for Meetings. */
  meetings: InkpathRow[]
  reports: {
    /** Entries whose typed hours differ from the times. */
    hoursDiffer: { row: InkpathRow; typed: number; fromTimes: number }[]
    /** Providers that look like people (kept as the institution; leads are not guessed). */
    peopleProviders: { provider: string; count: number }[]
    /** Skills in the workbook that are not on the skills list. */
    unknownSkills: { skill: string; rows: number[] }[]
    unmatchedNotes: { path: string; reason: string }[]
    unmatchedFolders: { row: InkpathRow; reason: string }[]
    withoutType: number
  }
  totals: {
    sourceEntries: number
    sourceMinutes: number
    plannedEntries: number
    plannedMinutes: number
  }
}

const rowLabel = (row: InkpathRow): string => `row ${row.row}: ${row.name || '(no name)'}`

// --- matching Obsidian notes and folders ---------------------------------------------------------

const STOPWORDS = new Set(['for', 'the', 'and', 'with', 'your', 'into', 'about', 'our', 'how'])

/** True when the shorter of two titles (by words) is inside the longer one, or they share most words. */
export function similarTitles(a: string, b: string): boolean {
  const x = titleWords(a)
  const y = titleWords(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const significant = (words: string): Set<string> =>
    new Set(words.split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w)))
  const wx = significant(x)
  const wy = significant(y)
  if (wx.size === 0 || wy.size === 0) return false
  const shared = [...wx].filter((w) => wy.has(w)).length
  return shared / Math.min(wx.size, wy.size) >= 0.6
}

interface FolderDates {
  from: string
  to: string
  title: string
}

/**
 * The dates and title a folder name starts with: `2025 12 10 Title`, `2026 05 19-20 Title`,
 * `2026 06 29 - 08 03 Title` or `2025 12 15 2026 07 10 Title` (a range). Null when it starts with no date.
 */
export function parseFolderName(name: string): FolderDates | null {
  const m = /^(\d{4}) (\d{2}) (\d{2})(.*)$/.exec(name)
  if (!m) return null
  const from = `${m[1]}-${m[2]}-${m[3]}`
  let rest = m[4]
  let to = from
  const full = /^\s+(\d{4}) (\d{2}) (\d{2})\b(.*)$/.exec(rest)
  const monthDay = /^\s*-\s*(\d{2}) (\d{2})\b(.*)$/.exec(rest)
  const day = /^\s*-\s*(\d{2})\b(?! \d)(.*)$/.exec(rest)
  if (full) {
    to = `${full[1]}-${full[2]}-${full[3]}`
    rest = full[4]
  } else if (monthDay) {
    to = `${m[1]}-${monthDay[1]}-${monthDay[2]}`
    rest = monthDay[3]
  } else if (day) {
    to = `${m[1]}-${m[2]}-${day[1]}`
    rest = day[2]
  }
  return { from, to, title: rest.trim() }
}

function matchFolder(
  row: InkpathRow,
  folders: readonly TrainingFolder[]
): { path: string } | { reason: string } | null {
  if (folders.length === 0) return null
  const hits = folders.filter((f) => {
    const name = f.path.split('/').at(-1) ?? ''
    const parsed = parseFolderName(name)
    if (!parsed) return false
    return (
      row.startDate >= parsed.from &&
      row.startDate <= parsed.to &&
      similarTitles(row.name, parsed.title)
    )
  })
  if (hits.length === 1) return { path: hits[0].path }
  if (hits.length > 1)
    return { reason: `${hits.length} folders fit: ${hits.map((h) => h.path).join(', ')}` }
  return { reason: 'no folder with this date and title' }
}

// --- the plan -------------------------------------------------------------------------------------

/**
 * Turn the Inkpath activities into entries. Nothing is guessed: what does not fit is reported and left
 * out or left empty. Every planned entry is checked against its source row (title, description, skills,
 * times, a note's text) and an entry that fails the check is left out, marked ATTENTION.
 */
export function planTrainingImport(input: ImportInput): ImportPlan {
  const meetings = input.rows.filter(isMeetingRow)
  const rows = input.rows.filter((r) => !isMeetingRow(r))
  const notes = (input.notes ?? []).map(parseTrainingNote)
  const usedNotes = new Set<string>()
  const taken = input.existing.map((e) => e.fileName.replace(/\.md$/i, ''))
  const existingKeys = new Set(input.existing.map((e) => `${e.date}|${titleWords(e.title)}`))
  const items: ImportItem[] = []
  const reports: ImportPlan['reports'] = {
    hoursDiffer: [],
    peopleProviders: [],
    unknownSkills: [],
    unmatchedNotes: [],
    unmatchedFolders: [],
    withoutType: 0
  }
  const providerCounts = new Map<string, number>()
  const unknownSkills = new Map<string, number[]>()

  // Which rows a note could belong to: same date and a similar title. A note is used only when exactly
  // one row and one note fit each other.
  const noteFor = (row: InkpathRow): ParsedTrainingNote | 'ambiguous' | null => {
    const fits = notes.filter((n) => n.date === row.startDate && similarTitles(n.title, row.name))
    if (fits.length === 0) return null
    const rowsForNote = (n: ParsedTrainingNote): number =>
      rows.filter((r) => r.startDate === n.date && similarTitles(n.title, r.name)).length
    if (fits.length > 1 || rowsForNote(fits[0]) > 1) return 'ambiguous'
    return fits[0]
  }

  for (const row of rows) {
    const source = rowLabel(row)
    const problems: string[] = []
    const notesOut: string[] = []

    if (!row.name) problems.push('No name')
    if (!row.startDate) problems.push('No usable start date')
    if (row.endDate && row.startDate && row.endDate !== row.startDate) {
      problems.push(
        `Runs over several days (${row.startDate} to ${row.endDate}); entries are single days`
      )
    }
    if (problems.length > 0) {
      items.push({ status: 'attention', source, problems })
      continue
    }

    const title = row.name.replace(/\s*\n\s*/g, ' ').trim()
    if (title !== row.name) notesOut.push('The title had a line break; it was joined into one line')
    const key = `${row.startDate}|${titleWords(title)}`
    if (existingKeys.has(key)) {
      items.push({
        status: 'skip-exists',
        source,
        reason: 'an entry with this date and title exists'
      })
      continue
    }
    existingKeys.add(key)

    // skills
    const split = splitSkills(row.skills)
    for (const u of split.unknown) unknownSkills.set(u, [...(unknownSkills.get(u) ?? []), row.row])
    const { kept, extra } = limitSkills(split.known)
    const review: string[] = []
    if (extra.length > 0) {
      review.push(
        `Inkpath listed ${split.known.length} skills; the first three were kept. Left out: ${extra.join(', ')}.`
      )
    }
    if (split.unknown.length > 0) {
      review.push(`Skills not on the list were left out: ${split.unknown.join('; ')}.`)
    }

    // format, series, type
    const series = seriesOfRow(row)
    let mode: TrainingPatch['mode'] = null
    if (/online/i.test(row.attendance)) mode = 'online'
    else if (/in person/i.test(row.attendance)) mode = 'in-person'
    else if (series === 'DataCamp') mode = 'self-paced'
    reports.withoutType++

    // provider
    const provider = row.provider
    if (provider) {
      providerCounts.set(provider, (providerCounts.get(provider) ?? 0) + 1)
    }

    // times and hours
    const minutes = durationMinutes(row.startTime, row.endTime)
    if (row.startTime && row.endTime && minutes === null) {
      notesOut.push(
        `The end time ${row.endTime} is not after the start ${row.startTime}; no duration`
      )
    }
    if (row.hours !== null && minutes !== null && Math.abs(row.hours * 60 - minutes) > 1) {
      reports.hoursDiffer.push({ row, typed: row.hours, fromTimes: minutes })
    }

    // note and folder
    let noteBody = ''
    let leads: string[] = []
    let matchedNote: string | null = null
    const found = noteFor(row)
    if (found === 'ambiguous')
      notesOut.push('More than one Obsidian note or activity fits; no note was attached')
    else if (found) {
      usedNotes.add(found.path)
      matchedNote = found.path
      noteBody = found.markdown
      leads = found.leads
    }
    let folder: string | null = null
    const folderMatch = matchFolder(row, input.folders ?? [])
    if (folderMatch && 'path' in folderMatch) folder = folderMatch.path
    else if (folderMatch) reports.unmatchedFolders.push({ row, reason: folderMatch.reason })

    const points = /^\d+(\.\d+)?$/.test(row.points) ? row.points : null
    const patch: TrainingPatch = {
      date: row.startDate,
      start: row.startTime || null,
      end: row.endTime || null,
      title,
      series,
      type: null,
      mode,
      skills: kept,
      leads,
      institution: provider || null,
      folder,
      organisation: row.organisation || null,
      points
    }
    const head = updateTrainingHead('', patch)
    const summary = row.description
    const body =
      `## Summary\n\n${summary ? `${summary}\n\n` : ''}## Notes\n` +
      (noteBody ? `\n${noteBody}` : '')
    const content = head + body

    const target = `${trainingBaseName(row.startDate, title, taken)}.md`
    const check = verifyPlanned(
      row,
      title,
      kept,
      content,
      found && found !== 'ambiguous' ? found : null
    )
    if (check.length > 0) {
      items.push({ status: 'attention', source, problems: check })
      continue
    }
    taken.push(target.replace(/\.md$/, ''))
    items.push({
      status: 'import',
      target,
      content,
      source,
      row,
      patch,
      minutes,
      notes: notesOut,
      todo: review.length > 0 ? review.join(' ') : null,
      leads,
      matchedNote
    })
  }

  for (const n of notes) {
    if (!usedNotes.has(n.path)) {
      reports.unmatchedNotes.push({
        path: n.path,
        reason: n.date
          ? 'no activity with this date and a similar title'
          : 'the file name has no date'
      })
    }
  }
  reports.peopleProviders = [...providerCounts]
    .filter(([p]) => looksLikePerson(p))
    .map(([provider, count]) => ({ provider, count }))
  reports.unknownSkills = [...unknownSkills].map(([skill, r]) => ({ skill, rows: r }))

  const planned = items.filter((i): i is PlannedEntry => i.status === 'import')
  const minutesOf = (r: InkpathRow): number => durationMinutes(r.startTime, r.endTime) ?? 0
  return {
    items,
    meetings,
    reports,
    totals: {
      sourceEntries: rows.length,
      sourceMinutes: rows.reduce((n, r) => n + minutesOf(r), 0),
      plannedEntries: planned.length,
      plannedMinutes: planned.reduce((n, p) => n + (p.minutes ?? 0), 0)
    }
  }
}

/**
 * Read the entry back from the text that would be written and compare it with its source row. Returns
 * what differs (empty when it is right). This is the safety net: an entry that fails is not written.
 */
export function verifyPlanned(
  row: InkpathRow,
  title: string,
  keptSkills: readonly string[],
  content: string,
  note: ParsedTrainingNote | null
): string[] {
  const problems: string[] = []
  const { head, body } = splitNote(content)
  const parsed = parseTrainingMeta(head)
  const meta = parsed.meta
  if (parsed.problems.length > 0) problems.push(`Front matter: ${parsed.problems.join('; ')}`)
  if (meta.title !== title) problems.push(`Title reads back as "${meta.title}"`)
  if (meta.date !== row.startDate) problems.push(`Date reads back as "${meta.date}"`)
  if ((meta.start ?? '') !== row.startTime || (meta.end ?? '') !== row.endTime) {
    problems.push('Times read back differently')
  }
  if (JSON.stringify(meta.skills) !== JSON.stringify(keptSkills))
    problems.push('Skills read back differently')
  const summary = (extractSection(body, 'Summary') ?? '').trim()
  if (summary !== row.description.trim())
    problems.push('The description does not read back as the Summary')
  if (note) {
    const notesText = extractSection(body, 'Notes') ?? ''
    if (
      JSON.stringify(linesOf(notesText.replace(/^#+\s/gm, ''))) !== JSON.stringify(note.sourceLines)
    ) {
      problems.push("The note's text changed in conversion")
    }
  }
  return problems
}
