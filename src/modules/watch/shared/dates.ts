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
const ORD = '(?:st|nd|rd|th)?'
/** "10 November 2026", "12-14 July 2027", "3rd Jun. 2027" */
const DAY_FIRST = new RegExp(
  `\\b(\\d{1,2})${ORD}(?:\\s*[-–]\\s*(\\d{1,2})${ORD})?\\s+${MONTH}\\.?,?\\s+(\\d{4})\\b`,
  'gi'
)
/** "November 10, 2026", "July 12-14, 2027" */
const MONTH_FIRST = new RegExp(
  `\\b${MONTH}\\.?\\s+(\\d{1,2})${ORD}(?:\\s*[-–]\\s*(\\d{1,2})${ORD})?,?\\s+(\\d{4})\\b`,
  'gi'
)
/** A range with both ends written out: "22 Sep 2026 - 11 Nov 2026", "30 Dec 2026 to 2 Jan 2027". */
const FULL_RANGE = new RegExp(
  `\\b(\\d{1,2})${ORD}\\s+${MONTH}\\.?,?\\s+(\\d{4})\\s*(?:[-–]|to|until)\\s*(\\d{1,2})${ORD}\\s+${MONTH}\\.?,?\\s+(\\d{4})\\b`,
  'gi'
)
/** A range that crosses a month: "30 June – 2 July 2027". */
const CROSS_MONTH = new RegExp(
  `\\b(\\d{1,2})${ORD}\\s+${MONTH}\\.?\\s*[-–]\\s*(\\d{1,2})${ORD}\\s+${MONTH}\\.?,?\\s+(\\d{4})\\b`,
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

const monthOf = (name: string): number | undefined => MONTHS[name.toLowerCase().replace(/\.$/, '')]

interface Found {
  date: string
  kind: DateKind
}

interface Span extends Found {
  /** The last day of a range ("12-14 July": the 14th). */
  end?: string
  index: number
  length: number
  /** What the words before a deadline say it is for ("Submit by"). */
  label: string
}

/** The words in front of a deadline, as the phrase the page shows beside it. */
function deadlineLabel(before: string): string {
  const w = /(submi|regist|appl)/i.exec(before.slice(-60))
  if (!w) return 'By'
  return w[1].toLowerCase() === 'submi'
    ? 'Submit by'
    : w[1].toLowerCase() === 'regist'
      ? 'Register by'
      : 'Apply by'
}

function span(
  text: string,
  m: RegExpMatchArray,
  date: string | null,
  end: string | null
): Span | null {
  if (!date) return null
  const index = m.index ?? 0
  // The words that qualify a date are the ones since the previous date ("… by 5 Nov 2026 for the day on 20 Feb 2027").
  const before = text.slice(Math.max(0, index - 60), index).replace(/^[\s\S]*\b\d{4}\b/, '')
  const kind = DEADLINE_WORDS.test(before) ? 'deadline' : 'date'
  return {
    date,
    kind,
    end: end && end > date ? end : undefined,
    index,
    length: m[0].length,
    label: kind === 'deadline' ? deadlineLabel(before) : ''
  }
}

/** Every written-out date in a text, in order of appearance, a range as one span. */
function spans(text: string): Span[] {
  const cross: Span[] = []
  for (const m of text.matchAll(CROSS_MONTH)) {
    const [m1, m2, y] = [monthOf(m[2]), monthOf(m[4]), Number(m[5])]
    if (!m1 || !m2) continue
    const found = span(
      text,
      m,
      iso(y, m1, Number(m[1])),
      iso(m2 < m1 ? y + 1 : y, m2, Number(m[3]))
    )
    if (found) cross.push(found)
  }
  for (const m of text.matchAll(FULL_RANGE)) {
    const [m1, m2] = [monthOf(m[2]), monthOf(m[5])]
    if (!m1 || !m2) continue
    const found = span(
      text,
      m,
      iso(Number(m[3]), m1, Number(m[1])),
      iso(Number(m[6]), m2, Number(m[4]))
    )
    if (found) cross.push(found)
  }
  const out: Span[] = [...cross]
  const inCross = (s: Span): boolean =>
    cross.some((c) => s.index >= c.index && s.index < c.index + c.length) ||
    cross.some((c) => c.index >= s.index && c.index < s.index + s.length)
  for (const m of text.matchAll(DAY_FIRST)) {
    const month = monthOf(m[3])
    const found = month
      ? span(
          text,
          m,
          iso(Number(m[4]), month, Number(m[1])),
          m[2] ? iso(Number(m[4]), month, Number(m[2])) : null
        )
      : null
    if (found && !inCross(found)) out.push(found)
  }
  for (const m of text.matchAll(MONTH_FIRST)) {
    const month = monthOf(m[1])
    const found = month
      ? span(
          text,
          m,
          iso(Number(m[4]), month, Number(m[2])),
          m[3] ? iso(Number(m[4]), month, Number(m[3])) : null
        )
      : null
    if (found && !inCross(found)) out.push(found)
  }
  return out.sort((a, b) => a.index - b.index)
}

/** A span still ahead: it ends today or later (a range under way counts). */
const ahead = (s: Span, today: string): boolean => (s.end ?? s.date) >= today

/**
 * The date that matters in a piece of text, on or after `today` (YYYY-MM-DD): the earliest deadline if the text names
 * one ("by 10 November 2026"), otherwise the earliest date of any kind. Past dates are ignored; a text with no
 * written-out date has none (numeric dates such as 10/11/2026 are ambiguous, so they are not read).
 */
export function findDate(text: string, today: string): Found | null {
  const all = spans(text)
    .filter((f) => ahead(f, today))
    .sort((a, b) => a.date.localeCompare(b.date))
  const pick = all.find((f) => f.kind === 'deadline') ?? all[0]
  return pick ? { date: pick.date, kind: pick.kind } : null
}

/** What a text says about when: the event's first and last day, and the earliest deadline, each only when still ahead. */
export interface FoundDates {
  eventStart: string | null
  eventEnd: string | null
  deadline: string | null
  /** "Apply by", "Submit by", "Register by" or "By". */
  deadlineLabel: string | null
}

export function findDates(text: string, today: string): FoundDates {
  const all = spans(text)
    .filter((f) => ahead(f, today))
    .sort((a, b) => a.date.localeCompare(b.date))
  const event = all.find((f) => f.kind === 'date')
  const due = all.find((f) => f.kind === 'deadline')
  return {
    eventStart: event?.date ?? null,
    eventEnd: event?.end ?? null,
    deadline: due?.date ?? null,
    deadlineLabel: due ? due.label : null
  }
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
  const all = spans(text)
  return all.length > 0 && all.every((f) => (f.end ?? f.date) < today)
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]
const parts = (day: string): { y: number; m: number; d: number } => ({
  y: Number(day.slice(0, 4)),
  m: Number(day.slice(5, 7)),
  d: Number(day.slice(8, 10))
})

/** "5 Nov", or "5 Nov 2027" with the year. */
export function dayLabel(day: string, withYear = false): string {
  const { y, m, d } = parts(day)
  return `${d} ${SHORT_MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`
}

/** An event's dates as the When column says them: "14 Nov 2026", "14–17 Jul 2027", "30 Jun – 2 Jul 2027". */
export function whenLabel(start: string, end: string | null): string {
  if (!end || end <= start) return dayLabel(start, true)
  const [a, b] = [parts(start), parts(end)]
  if (a.y !== b.y) return `${dayLabel(start, true)} – ${dayLabel(end, true)}`
  if (a.m === b.m) return `${a.d}–${b.d} ${SHORT_MONTHS[a.m - 1]} ${a.y}`
  return `${dayLabel(start)} – ${dayLabel(end, true)}`
}

/** Dates a structured source gave that are over: the event ended before `today`. (An event with no date at all is not over.) */
export function structuredOver(
  dates: { eventStart: string | null; eventEnd: string | null },
  today: string
): boolean {
  return dates.eventStart !== null && (dates.eventEnd ?? dates.eventStart) < today
}
