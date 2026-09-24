/** Readers for the two Word sources of the meeting import. They work on plain text (converted by the tool). */

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** "July 9, 2026", "Nov 20, 2025", "Sept 3, 2025" as YYYY-MM-DD; null for anything else or an impossible date. */
export function parseLongDate(text: string): string | null {
  const m = /^\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})\s*$/.exec(text)
  if (!m) return null
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()]
  const day = Number(m[2])
  const year = Number(m[3])
  if (!month) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    return null
  return `${year}-${pad(month)}-${pad(day)}`
}

const TIME = /^(\d{1,2}):(\d{2})$/
function time(text: string): string | null {
  const m = TIME.exec(text.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : null
}

export interface WordHeader {
  /** YYYY-MM-DD. */
  date: string
  start: string
  end: string
}

/**
 * The first line of a Word meeting note: `July 9, 2026 | 10:00 – 11:00` (an en dash, a hyphen or an em dash;
 * hours may have one digit). Null when the first non-empty line is not in that shape.
 */
export function parseWordHeader(text: string): WordHeader | null {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== '')
  if (!first) return null
  const m = /^(.+?)\s*\|\s*(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})\s*$/.exec(first)
  if (!m) return null
  const date = parseLongDate(m[1])
  const start = time(m[2])
  const end = time(m[3])
  return date && start && end ? { date, start, end } : null
}

export interface LogRow {
  date: string
  /** "Visit", "Teams", … as written in the log's Type of contact column. */
  contact: string
  mode: 'in-person' | 'online' | null
  minutes: number | null
  /** The comments column: the summary. */
  comment: string
  /** Attendee initials as written. */
  initials: string[]
}

const DATE_LINE = /^[A-Za-z]{3,9}\.? \d{1,2}, \d{4}$/
const INITIALS = /^[A-Z]{2,4}$/

/**
 * The rows of the Word supervisor log (converted to text, one table cell per line): date, type of contact,
 * online / in person, duration, comments, then the initials of who was there (a blank line stands in for
 * someone who was not). Header and footer text is ignored; a row is only ever read as far as the next date.
 */
export function parseSupervisorLog(text: string): LogRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''))
  const starts = lines.flatMap((l, i) => (DATE_LINE.test(l.trim()) && parseLongDate(l) ? [i] : []))
  return starts.map((start, n) => {
    const block = lines.slice(start + 1, starts[n + 1] ?? lines.length)
    const footer = block.findIndex((l) => /^Record of PGR/i.test(l.trim()))
    const cells = footer === -1 ? block : block.slice(0, footer)
    const [contact = '', modeText = '', durationText = '', ...rest] = cells
    const firstInitials = rest.findIndex((l) => INITIALS.test(l.trim()))
    const commentLines = firstInitials === -1 ? rest : rest.slice(0, firstInitials)
    const initials =
      firstInitials === -1
        ? []
        : rest
            .slice(firstInitials)
            .map((l) => l.trim())
            .filter((l) => INITIALS.test(l))
    const minutes = /^(\d+)\s*min/i.exec(durationText.trim())
    return {
      date: parseLongDate(lines[start]) as string,
      contact: contact.trim(),
      mode: /online/i.test(modeText) ? 'online' : /in person/i.test(modeText) ? 'in-person' : null,
      minutes: minutes ? Number(minutes[1]) : null,
      comment: commentLines
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' '),
      initials
    }
  })
}
