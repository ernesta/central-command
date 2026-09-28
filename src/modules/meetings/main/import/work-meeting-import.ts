/**
 * Importing Work meetings from Obsidian (`docs/DECISIONS.md`, "Work meetings import"). Unlike the Research
 * importer (`meeting-import.ts`), there is no Word log or Word notes to merge in: the vault is the only
 * source, so start, end and a summary are never known and are left empty. `parseObsidianMeeting` (already
 * built for Research's own `**Date**:`/`**Attendees**:` header) is reused as-is; only the series comes from
 * somewhere different (the vault's own sub-folder, not a tag or a name pattern).
 */
import { transformBody } from '../../../readings/main/obsidian-import'
import { parseMeta, splitNote, updateHead } from '../../shared/front-matter'
import { parseTodos } from '../../shared/todos'
import type { MeetingMeta } from '../../shared/types'
import { meetingBaseName } from '../file-name'
import { parseObsidianMeeting, type ObsidianInput } from './meeting-import'

export interface ExistingWorkMeeting {
  fileName: string
}

export interface WorkPlanInput {
  obsidian: ObsidianInput[]
  existing: ExistingWorkMeeting[]
  /** Turns a note body into the app's Markdown. Only tests change this, to prove the TODO check catches a bad conversion. */
  transform?: (body: string) => { markdown: string }
}

export interface PlannedWorkMeeting {
  status: 'import'
  source: string
  target: string
  meta: MeetingMeta
  content: string
  /** Things worth knowing about this meeting, including every "TOOD" typo fixed. */
  notes: string[]
}

export type WorkPlanItem =
  | PlannedWorkMeeting
  | { status: 'skip-exists'; source: string; target: string; reason: string }
  | { status: 'attention'; source: string; problems: string[] }

export interface WorkMeetingImportPlan {
  items: WorkPlanItem[]
}

/** Wikilinks become their text, as the importer does to the whole body. */
const unlink = (text: string): string =>
  text.replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/!?\[\[([^\]]+)\]\]/g, '$1')

/** Obsidian syntax converted, but every heading and bullet kept as written. */
const keepStructure = (body: string): { markdown: string } =>
  transformBody(body, { keepEmptyHeadings: true, keepEmptyBullets: true })

/** How many `TODO` markers a text holds, counted independently of the parser. */
function markerCount(text: string): number {
  return (text.match(/\bTODO\s*(?:\([^()]*\))?\s*(?:\*\*)?\s*:/g) ?? []).length
}

/** `TOOD(EO)` and `TOOD (EO)` -> `TODO(EO)` / `TODO (EO)`; the only typo the vault is known to have. */
function fixTodoTypo(text: string): { fixed: string; count: number } {
  const count = (text.match(/\bTOOD\b(?=\s*\(|\s*:)/g) ?? []).length
  return { fixed: text.replace(/\bTOOD\b(?=\s*\(|\s*:)/g, 'TODO'), count }
}

/**
 * Work out what to write for every Obsidian meeting note in a Work vault. Nothing is guessed: a note with
 * no readable date or attendees line is reported (`attention`) and left out, an existing meeting is never
 * touched (`skip-exists`), and a `TOOD` typo is fixed (reported, not silently). Pure: it reads and writes
 * nothing.
 */
export function planWorkMeetingImport(input: WorkPlanInput): WorkMeetingImportPlan {
  const taken = new Set(input.existing.map((e) => e.fileName.replace(/\.md$/i, '')))
  const seenKeys = new Map<string, string>() // "date|series" -> source
  const items: WorkPlanItem[] = []

  for (const file of input.obsidian) {
    const parsed = parseObsidianMeeting(file)
    const series = file.folder || null
    const problems = [...parsed.problems]
    if (!series) problems.push('No sub-folder to use as the series')
    if (!parsed.date || !series) {
      items.push({ status: 'attention', source: file.fileName, problems })
      continue
    }

    const key = `${parsed.date}|${series}`
    const already = seenKeys.get(key)
    seenKeys.set(key, file.fileName)

    const notes: string[] = [...parsed.problems]
    // Two distinct meetings, same date and series: both import (the numeric suffix `meetingBaseName`
    // already gives a second taken stem), named apart rather than guessing which one to keep.
    if (already !== undefined) {
      notes.push(
        `Also ${series} on ${parsed.date}: ${already}. Named apart, not merged or guessed.`
      )
    }
    if (parsed.headerDate && parsed.headerDate !== parsed.date) {
      notes.push(`The Date line says ${parsed.headerDate}; using the file name date ${parsed.date}`)
    }

    const { fixed: typoFixed, count: typoCount } = fixTodoTypo(parsed.body)
    if (typoCount > 0) notes.push(`Fixed ${typoCount} "TOOD" typo(s) to "TODO"`)
    const { markdown } = (input.transform ?? keepStructure)(typoFixed)
    const finalBody = (markdown.endsWith('\n') ? markdown : `${markdown}\n`) || '\n'

    // Safety: every TODO in the source (after the typo fix, which is the one deliberate change) must
    // still be there, word for word, and no ticked box may change.
    const source = unlink(typoFixed.replace(/\r\n?/g, '\n'))
    const lost = parseTodos(source).filter((t) => !finalBody.includes(t.text))
    const ticked = (text: string): number => (text.match(/^\s*[-*+]\s+\[[xX]\]/gm) ?? []).length
    if (
      lost.length > 0 ||
      markerCount(source) !== markerCount(finalBody) ||
      ticked(source) !== ticked(finalBody)
    ) {
      items.push({
        status: 'attention',
        source: file.fileName,
        problems: [
          `The TODO check failed (${markerCount(source)} TODOs and ${ticked(source)} ticked boxes in the note, ${markerCount(finalBody)} and ${ticked(finalBody)} after conversion): nothing was written for this note`
        ]
      })
      continue
    }

    const meta: MeetingMeta = {
      series,
      date: parsed.date,
      start: null,
      end: null,
      mode: null,
      attendees: parsed.attendees,
      discussed: [],
      skills: []
    }
    const stem = meetingBaseName(parsed.date, series, taken)
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
      back.attendees.join('|') !== meta.attendees.join('|')
    ) {
      items.push({
        status: 'attention',
        source: file.fileName,
        problems: ['The front matter did not read back the same; nothing was written for this note']
      })
      continue
    }

    items.push({
      status: 'import',
      source: file.fileName,
      target: `${stem}.md`,
      meta,
      content,
      notes
    })
  }

  return { items }
}
