import type { DateKind } from './types'

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
}

const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
/** "10 November 2026", "12-14 July 2027", "3rd Jun. 2027" */
const DAY_FIRST = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?\\s+${MONTH}\\.?,?\\s+(\\d{4})\\b`,
  'gi'
)
/** "November 10, 2026", "July 12-14, 2027" */
const MONTH_FIRST = new RegExp(
  `\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?,?\\s+(\\d{4})\\b`,
  'gi'
)
const DEADLINE_WORDS =
  /(deadline|by|before|until|no later than|due|submit|submission|apply|application|closes?|register)\W[^.]{0,40}$/i

function iso(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface Found {
  date: string
  kind: DateKind
}

function scan(text: string, re: RegExp, order: 'day-first' | 'month-first'): Found[] {
  const out: Found[] = []
  for (const m of text.matchAll(re)) {
    const [day, monthName, year] = order === 'day-first' ? [m[1], m[2], m[3]] : [m[2], m[1], m[3]]
    const month = MONTHS[monthName.toLowerCase().replace(/\.$/, '')]
    const date = month ? iso(Number(year), month, Number(day)) : null
    if (!date) continue
    const before = text.slice(Math.max(0, (m.index ?? 0) - 60), m.index ?? 0)
    out.push({ date, kind: DEADLINE_WORDS.test(before) ? 'deadline' : 'date' })
  }
  return out
}

/**
 * The date that matters in a piece of text, on or after `today` (YYYY-MM-DD): the earliest deadline if the text names
 * one ("by 10 November 2026"), otherwise the earliest date of any kind. Past dates are ignored; a text with no
 * written-out date has none (numeric dates such as 10/11/2026 are ambiguous, so they are not read).
 */
export function findDate(text: string, today: string): Found | null {
  const all = [...scan(text, DAY_FIRST, 'day-first'), ...scan(text, MONTH_FIRST, 'month-first')]
    .filter((f) => f.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
  return all.find((f) => f.kind === 'deadline') ?? all[0] ?? null
}

/**
 * A title that ends with the date of its event ("EPS Meeting: Cardiff University. 7th – 9th April 2027"): the title without
 * it, and the date as a short phrase ("7–9 April 2027"). A title that does not end with a date is returned whole.
 */
export function splitTrailingDate(title: string): { name: string; when: string } {
  const text = title.replace(/[\s.]+$/, '')
  for (const re of [DAY_FIRST, MONTH_FIRST]) {
    for (const m of text.matchAll(re)) {
      if ((m.index ?? 0) + m[0].length !== text.length) continue
      const name = text.slice(0, m.index).replace(/[\s.,;:–-]+$/, '')
      if (!name) continue
      const when = m[0].replace(/(\d)(?:st|nd|rd|th)/g, '$1').replace(/\s*[-–]\s*/, '–')
      return { name, when }
    }
  }
  return { name: title, when: '' }
}

/** True when the text names dates and every one is before `today`: an event or deadline that is over. A text with no written-out date is not. */
export function isOver(text: string, today: string): boolean {
  const all = [...scan(text, DAY_FIRST, 'day-first'), ...scan(text, MONTH_FIRST, 'month-first')]
  return all.length > 0 && all.every((f) => f.date < today)
}
