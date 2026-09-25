import { fold } from '@shared/text'
import { transformBody } from '../../../readings/main/obsidian-import'

/** An Obsidian training note, as read from the vault (never modified). */
export interface ObsidianTrainingNote {
  /** Path inside the vault's Training folder, for reports. */
  path: string
  fileName: string
  text: string
}

export interface ParsedTrainingNote {
  path: string
  /** YYYY-MM-DD from the file name (`2025 12 10 Title.md`), or ''. */
  date: string
  title: string
  /** Names from `**Lead**: Prof [[Ryan McKay]]`, without titles. */
  leads: string[]
  /** What the user wrote, ready for the app: tags and the Lead line dropped, wikilinks flattened. */
  markdown: string
  /** The text lines that must survive the conversion, for the safety check. */
  sourceLines: string[]
}

const TITLES = /^(prof|professor|dr|mr|mrs|ms|miss|mx)\.?\s+/i

/** "Prof [[Ryan McKay]]" and "Dr Ada Lovelace, Bob Ross" as names, titles removed. */
export function parseLeads(text: string): string[] {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .split(/,|;| and | & /)
    .map((s) => s.replace(TITLES, '').trim())
    .filter(Boolean)
}

/** Fold and reduce to words, to compare titles that differ in punctuation, case or accents. */
export const titleWords = (title: string): string =>
  fold(title)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const HEADING = /^(#{1,6})(\s.*)$/

/**
 * Read one Obsidian training note. The tag line (`#psychology #training`) and the `**Lead**:` line are
 * taken out (the lead becomes a field); the rest keeps every line, with wikilinks flattened and each
 * heading one level deeper (the text goes under the entry's own `## Notes`).
 */
export function parseTrainingNote(note: ObsidianTrainingNote): ParsedTrainingNote {
  const base = note.fileName.replace(/\.md$/i, '')
  const m = /^(\d{4}) (\d{2}) (\d{2})\s+(.*)$/.exec(base)
  const date = m ? `${m[1]}-${m[2]}-${m[3]}` : ''
  const title = m ? m[4] : base

  const leads: string[] = []
  const kept = note.text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => {
      if (/^(#[\p{L}\p{N}_/-]+\s*)+$/u.test(line.trim())) return false // the tag line
      const lead = /^\*\*Leads?\*\*\s*:\s*(.*)$/.exec(line.trim())
      if (lead) {
        leads.push(...parseLeads(lead[1]))
        return false
      }
      return true
    })
  const { markdown } = transformBody(kept.join('\n'), {
    keepEmptyHeadings: true,
    keepEmptyBullets: true
  })
  const deeper = markdown
    .split('\n')
    .map((line) => {
      const h = HEADING.exec(line)
      return h ? `${'#'.repeat(Math.min(6, h[1].length + 1))}${h[2]}` : line
    })
    .join('\n')
  // What must survive, worked out from the source alone (not from the converted text).
  const sourceLines = linesOf(
    kept
      .join('\n')
      .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/!?\[\[([^\]]+)\]\]/g, '$1')
      .replace(/^#{1,6}\s/gm, '')
  )
  return { path: note.path, date, title, leads, markdown: deeper, sourceLines }
}

/** The non-empty, trimmed lines of a text, for comparing a note before and after conversion. */
export function linesOf(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
}
