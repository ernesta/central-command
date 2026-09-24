import { transformBody } from '../../../readings/main/obsidian-import'
import { parseMeta, splitNote, updateHead } from '../../shared/front-matter'
import { parseTodos } from '../../shared/todos'
import { extractSection } from '../../shared/sections'
import { durationMinutes } from '../../shared/time'
import type { MeetingMeta, MeetingMode } from '../../shared/types'
import { meetingBaseName } from '../file-name'
import { parseLongDate, parseSupervisorLog, parseWordHeader, type LogRow } from './word-sources'

// ---------------------------------------------------------------------------------------------
// Reading one Obsidian meeting note
// ---------------------------------------------------------------------------------------------

export interface ObsidianInput {
  /** e.g. "2025 11 26 Supervisor Meeting.md" */
  fileName: string
  /** The sub-folder it was in ("Supervision"), or ''. */
  folder: string
  text: string
}

export interface ParsedObsidianMeeting {
  fileName: string
  /** From the file name (`YYYY MM DD …`), which is what the import trusts. */
  date: string | null
  /** From the `**Date**:` line, if it could be read. */
  headerDate: string | null
  tags: string[]
  attendees: string[]
  /** Everything after the tags, Date and Attendees lines, untouched. */
  body: string
  series: string | null
  problems: string[]
}

const TITLES = /^(prof(?:essor)?|dr|mr|mrs|ms|miss|mx)\.?\s+/i

/** Names from an Attendees line: wikilinks reduced to their text, titles dropped, repeats removed. */
export function parseAttendees(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of text.split(/[,;]/)) {
    const name = part
      .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
      .replace(/\[\[([^\]]*)\]\]/g, '$1')
      .trim()
      .replace(TITLES, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      out.push(name)
    }
  }
  return out
}

/** The series a note belongs to, from its folder, tags and file name; null when none of them says. */
export function seriesFor(
  fileName: string,
  tags: readonly string[],
  folder: string
): string | null {
  if (tags.includes('supervisor-meeting') || folder === 'Supervision') return 'Supervision'
  if (/rastle lab/i.test(fileName) || tags.includes('rastle-lab')) return 'Rastle Lab'
  if (tags.includes('luminos')) return 'Luminos'
  if (/annual review/i.test(fileName)) return 'Other'
  return null
}

const FILE_DATE = /^(\d{4}) (\d{2}) (\d{2})\b/
const TAG_LINE = /^(#[\w-]+)(\s+#[\w-]+)*\s*$/

export function parseObsidianMeeting(input: ObsidianInput): ParsedObsidianMeeting {
  const problems: string[] = []
  const fd = FILE_DATE.exec(input.fileName)
  const date = fd ? `${fd[1]}-${fd[2]}-${fd[3]}` : null
  if (!date) problems.push('The file name does not start with a date (YYYY MM DD)')

  const lines = input.text.replace(/\r\n?/g, '\n').split('\n')
  const tags: string[] = []
  let headerDate: string | null = null
  let attendees: string[] = []
  let sawDate = false
  let sawAttendees = false
  let i = 0
  for (; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue
    if (TAG_LINE.test(line)) {
      for (const t of line.split(/\s+/)) tags.push(t.slice(1))
      continue
    }
    const d = /^\*\*Date\*\*\s*:\s*(.*)$/.exec(line)
    if (d) {
      sawDate = true
      headerDate = parseLongDate(d[1])
      if (!headerDate) problems.push(`The Date line could not be read: "${d[1]}"`)
      continue
    }
    const a = /^\*\*Attendees\*\*\s*:\s*(.*)$/.exec(line)
    if (a) {
      sawAttendees = true
      attendees = parseAttendees(a[1])
      continue
    }
    break
  }
  if (!sawDate) problems.push('No Date line')
  if (!sawAttendees) problems.push('No Attendees line')

  return {
    fileName: input.fileName,
    date,
    headerDate,
    tags,
    attendees,
    body: lines.slice(i).join('\n'),
    series: seriesFor(input.fileName, tags, input.folder),
    problems
  }
}

// ---------------------------------------------------------------------------------------------
// Planning the whole import
// ---------------------------------------------------------------------------------------------

export interface WordNoteInput {
  fileName: string
  /** The note as plain text. */
  text: string
}

export interface ExistingMeeting {
  fileName: string
  /** '' when unknown. */
  date: string
  series: string
}

export interface PlanInput {
  obsidian: ObsidianInput[]
  wordNotes: WordNoteInput[]
  logText: string | null
  existing: ExistingMeeting[]
  /** Turns a note body into the app's Markdown. Only tests change this, to prove the TODO check catches a bad conversion. */
  transform?: (body: string) => { markdown: string }
}

export interface PlannedMeeting {
  status: 'import'
  source: string
  /** File name to write, e.g. "2025-11-26 Supervision.md". */
  target: string
  meta: MeetingMeta
  /** The complete file text. */
  content: string
  /** Things worth knowing about this meeting. */
  notes: string[]
}

export type PlanItem =
  | PlannedMeeting
  | { status: 'skip-exists'; source: string; target: string; reason: string }
  | { status: 'attention'; source: string; problems: string[] }

export interface Reminders {
  /** The `**Date**` line disagreed with the file name; the file name (checked against the Word notes and the log) was used. */
  dateMismatches: { source: string; headerDate: string; usedDate: string }[]
  /** The Word log and the Word note give different durations; the note's times were used. */
  durationMismatches: { date: string; logMinutes: number; noteMinutes: number }[]
  /** Meetings with no Word note, so no start and end times. */
  noTimes: { source: string; date: string; series: string }[]
}

export interface MeetingImportPlan {
  items: PlanItem[]
  /** Sources that did not line up (a Word note or log row with no Obsidian note, and so on). */
  anomalies: string[]
  reminders: Reminders
}

const WORD_DATE = /^(\d{4}) (\d{2}) (\d{2})\b/
const modeOf = (row: LogRow | undefined): MeetingMode | null => row?.mode ?? null

/** How many `TODO` markers a text holds, counted independently of the parser. */
function markerCount(text: string): number {
  return (text.match(/\bTODO\s*(?:\([^()]*\))?\s*(?:\*\*)?\s*:/g) ?? []).length
}

/** Obsidian syntax converted, but every heading and bullet kept as written. */
const keepStructure = (body: string): { markdown: string } =>
  transformBody(body, { keepEmptyHeadings: true, keepEmptyBullets: true })

/** Wikilinks become their text, as the importer does to the whole body. */
const unlink = (text: string): string =>
  text.replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/!?\[\[([^\]]+)\]\]/g, '$1')

/**
 * Work out what to write for every Obsidian meeting note, using the Word notes for start and end times and
 * the Word log for summaries and type. Nothing is guessed: a note that cannot be placed is reported
 * (`attention`) and left out, an existing meeting is never touched (`skip-exists`), and the file name date
 * is the one used, with any disagreement reported. Pure: it reads and writes nothing.
 */
export function planMeetingImport(input: PlanInput): MeetingImportPlan {
  const anomalies: string[] = []
  const reminders: Reminders = { dateMismatches: [], durationMismatches: [], noTimes: [] }

  const parsed = input.obsidian.map(parseObsidianMeeting)
  const log = input.logText ? parseSupervisorLog(input.logText) : []

  // Word notes by the date in their file name (and their own first line, which must agree).
  const words = new Map<string, { note: WordNoteInput; series: string | null }[]>()
  for (const note of input.wordNotes) {
    if (note.fileName.startsWith('~$')) continue // Word's lock files
    const fd = WORD_DATE.exec(note.fileName)
    const header = parseWordHeader(note.text)
    if (!fd) {
      anomalies.push(`Word note "${note.fileName}": the file name does not start with a date`)
      continue
    }
    const date = `${fd[1]}-${fd[2]}-${fd[3]}`
    if (!header) {
      anomalies.push(`Word note "${note.fileName}": the first line is not "date | start – end"`)
      continue
    }
    if (header.date !== date) {
      anomalies.push(`Word note "${note.fileName}": its first line says ${header.date}`)
      continue
    }
    const series = /rastle lab/i.test(note.fileName)
      ? 'Rastle Lab'
      : /supervisor/i.test(note.fileName)
        ? 'Supervision'
        : null
    words.set(date, [...(words.get(date) ?? []), { note, series }])
  }
  const usedWords = new Set<WordNoteInput>()
  const usedLog = new Set<LogRow>()

  const taken = new Set(input.existing.map((e) => e.fileName.replace(/\.md$/i, '')))
  const seenKeys = new Map<string, string>() // "date|series" -> source
  for (const e of input.existing) if (e.date) seenKeys.set(`${e.date}|${e.series}`, e.fileName)

  const items: PlanItem[] = []
  for (const note of parsed) {
    const problems = [...note.problems]
    if (!note.date) {
      items.push({ status: 'attention', source: note.fileName, problems })
      continue
    }
    if (!note.series) {
      items.push({
        status: 'attention',
        source: note.fileName,
        problems: [
          ...problems,
          'The series could not be worked out (no supervisor-meeting or luminos tag, and the name is not a Rastle Lab or Annual Review meeting)'
        ]
      })
      continue
    }
    const key = `${note.date}|${note.series}`
    const already = seenKeys.get(key)
    if (already !== undefined) {
      const fromExisting = input.existing.some((e) => e.fileName === already)
      items.push(
        fromExisting
          ? {
              status: 'skip-exists',
              source: note.fileName,
              target: already,
              reason: `${note.series} on ${note.date} is already in your meetings; left untouched`
            }
          : {
              status: 'attention',
              source: note.fileName,
              problems: [
                `Two notes in the vault are for ${note.series} on ${note.date} (also ${already}); nothing was guessed`
              ]
            }
      )
      continue
    }
    seenKeys.set(key, note.fileName)

    const notes: string[] = [...note.problems]
    if (note.headerDate && note.headerDate !== note.date) {
      reminders.dateMismatches.push({
        source: note.fileName,
        headerDate: note.headerDate,
        usedDate: note.date
      })
      notes.push(`The Date line says ${note.headerDate}; using the file name date ${note.date}`)
    }

    // Times from the Word note of the same day (for Rastle Lab, the one named for it).
    const candidates = (words.get(note.date) ?? []).filter(
      (w) => w.series === null || w.series === note.series
    )
    let start: string | null = null
    let end: string | null = null
    if (candidates.length > 1) {
      anomalies.push(
        `${note.fileName}: more than one Word note for ${note.date}; no times were taken`
      )
    } else if (candidates.length === 1) {
      const header = parseWordHeader(candidates[0].note.text)
      if (header) {
        start = header.start
        end = header.end
        usedWords.add(candidates[0].note)
      }
    }

    // Summary and type from the log (supervision meetings only).
    let row: LogRow | undefined
    if (note.series === 'Supervision') {
      const rows = log.filter((r) => r.date === note.date)
      if (rows.length > 1)
        anomalies.push(
          `${note.fileName}: ${rows.length} log rows for ${note.date}; no summary was taken`
        )
      else if (rows.length === 1) {
        row = rows[0]
        usedLog.add(row)
      } else if (input.logText)
        notes.push('No row in the Word log for this date: no summary or type')
    }
    const noteMinutes = durationMinutes(start, end)
    if (row?.minutes != null && noteMinutes !== null && row.minutes !== noteMinutes) {
      reminders.durationMismatches.push({ date: note.date, logMinutes: row.minutes, noteMinutes })
      notes.push(
        `The log says ${row.minutes} min but the Word note's times give ${noteMinutes} min; using the note's times`
      )
    }
    if (start === null)
      reminders.noTimes.push({ source: note.fileName, date: note.date, series: note.series })

    // The body, in the editor's canonical form.
    const renamed = note.body.replace(/^##\s+Previous Action Items\s*$/gim, '## Previous TODOs')
    const { markdown } = (input.transform ?? keepStructure)(renamed)
    const summary = (row?.comment ?? '').trim()
    const body = '## Summary\n\n' + (summary ? `${summary}\n\n` : '') + (markdown ? markdown : '')
    const finalBody = body.endsWith('\n') ? body : `${body}\n`

    // Safety: every TODO in the source must still be there, word for word, and no ticked box may change.
    // (Where the app files a TODO, as a Previous TODO or an inline one, is its own business; the text is what matters.)
    const source = unlink(note.body.replace(/\r\n?/g, '\n'))
    const lost = parseTodos(source).filter((t) => !finalBody.includes(t.text))
    const ticked = (text: string): number => (text.match(/^\s*[-*+]\s+\[[xX]\]/gm) ?? []).length
    if (
      lost.length > 0 ||
      markerCount(source) !== markerCount(finalBody) ||
      ticked(source) !== ticked(finalBody)
    ) {
      items.push({
        status: 'attention',
        source: note.fileName,
        problems: [
          `The TODO check failed (${markerCount(source)} TODOs and ${ticked(source)} ticked boxes in the note, ${markerCount(finalBody)} and ${ticked(finalBody)} after conversion): nothing was written for this note`
        ]
      })
      continue
    }

    const meta: MeetingMeta = {
      series: note.series,
      date: note.date,
      start,
      end,
      mode: modeOf(row),
      attendees: note.attendees,
      discussed: []
    }
    const stem = meetingBaseName(note.date, note.series, taken)
    taken.add(stem)
    const head = updateHead('', {
      series: meta.series,
      date: meta.date,
      start: meta.start,
      end: meta.end,
      mode: meta.mode,
      attendees: meta.attendees
    })
    const content = head + finalBody
    // Reading the result back must give the same fields.
    const back = parseMeta(splitNote(content).head).meta
    if (
      back.date !== meta.date ||
      back.series !== meta.series ||
      back.start !== meta.start ||
      back.end !== meta.end ||
      back.mode !== meta.mode ||
      back.attendees.join('|') !== meta.attendees.join('|')
    ) {
      items.push({
        status: 'attention',
        source: note.fileName,
        problems: ['The front matter did not read back the same; nothing was written for this note']
      })
      continue
    }
    if (summary && (extractSection(finalBody, 'Summary') ?? '') !== summary) {
      items.push({
        status: 'attention',
        source: note.fileName,
        problems: ['The summary did not read back the same; nothing was written for this note']
      })
      continue
    }
    items.push({
      status: 'import',
      source: note.fileName,
      target: `${stem}.md`,
      meta,
      content,
      notes
    })
  }

  for (const list of words.values()) {
    for (const w of list) {
      if (!usedWords.has(w.note))
        anomalies.push(`Word note "${w.note.fileName}" was not matched to a meeting note`)
    }
  }
  for (const r of log) {
    if (!usedLog.has(r))
      anomalies.push(`Log row for ${r.date} was not matched to a supervision note`)
  }

  return { items, anomalies, reminders }
}
