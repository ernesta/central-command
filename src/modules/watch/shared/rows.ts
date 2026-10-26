import { daysBetween } from '@shared/year'
import { formatDate, formatShortDate } from '@shared/time'
import {
  shownKind,
  type ShownKind,
  type WatchItem,
  type WatchKind,
  type WatchSource
} from './types'

export const KIND_NOUN: Record<ShownKind, { one: string; many: string }> = {
  training: { one: 'Training', many: 'Trainings' },
  conference: { one: 'Conference', many: 'Conferences' }
}

/** The day an item was found, said the way the landing lists say a date: "Today", "Yesterday", "3 days ago", then the date. */
export function foundLabel(firstSeenAt: string, today: string): string {
  const day = firstSeenAt.slice(0, 10)
  const ago = daysBetween(day, today)
  if (ago <= 0) return 'Today'
  if (ago === 1) return 'Yesterday'
  if (ago < 7) return `${ago} days ago`
  return day.slice(0, 4) === today.slice(0, 4) ? formatShortDate(day) : formatDate(day)
}

/** What a row says at the right of the source: a deadline still to come ("Apply by 5 Nov"), and nothing otherwise. */
export function noteFor(item: WatchItem, today: string): string {
  if (item.dateKind !== 'deadline' || !item.date || item.date < today) return ''
  return `Apply by ${formatShortDate(item.date)}`
}

export interface WatchSections {
  saved: WatchItem[]
  training: WatchItem[]
  conference: WatchItem[]
}

/** How many unsaved items each section of the page lists; "See all" has the rest. */
export const SHOWN_PER_SECTION = 8

/**
 * The page's sections from every item that is not dismissed: what is saved (of either kind) first, then each kind's
 * unsaved items, newest first. An item of a kind the page does not show (a journal) is left out.
 */
export function sectionsOf(items: readonly WatchItem[]): WatchSections {
  const live = items.filter((i) => i.state !== 'dismissed' && shownKind(i.kind) !== null)
  const unsaved = (kind: ShownKind): WatchItem[] =>
    live.filter((i) => i.state !== 'saved' && shownKind(i.kind) === kind)
  return {
    saved: live.filter((i) => i.state === 'saved').sort(bySoonestDeadline),
    training: unsaved('training'),
    conference: unsaved('conference')
  }
}

/** Saved items by what they are due: the nearest date first, items with no date after them. */
function bySoonestDeadline(a: WatchItem, b: WatchItem): number {
  if (a.date && b.date) return a.date.localeCompare(b.date)
  if (a.date) return -1
  if (b.date) return 1
  return b.firstSeenAt.localeCompare(a.firstSeenAt)
}

export interface CheckedLabel {
  text: string
  /** The source's last attempt failed: the text is a problem, drawn in the danger colour. */
  failing: boolean
}

/** The "Last checked" cell: when it was, or (only for a failing source) how many tries have failed. */
export function checkedLabel(
  source: Pick<WatchSource, 'lastCheckedAt' | 'lastError' | 'failures'>,
  today: string
): CheckedLabel {
  if (source.lastError)
    return {
      text: `Can’t open: ${source.failures} ${source.failures === 1 ? 'try' : 'tries'}`,
      failing: true
    }
  if (!source.lastCheckedAt) return { text: 'Not yet', failing: false }
  return { text: foundLabel(source.lastCheckedAt, today), failing: false }
}

/** How often a source is checked, in hours, as the choices the dialog offers. */
export const EVERY_OPTIONS = [
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: 'Day' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: 'Week' }
] as const

/** "Day" for 24, or the odd number of hours a hand-edited source may have. */
export function everyLabel(hours: number): string {
  return EVERY_OPTIONS.find((o) => o.hours === hours)?.label ?? `${hours} hours`
}

export const KIND_LABEL: Record<WatchKind, string> = {
  training: 'Training',
  'summer-school': 'Training',
  conference: 'Conference',
  journal: 'Journal',
  listing: 'Listing',
  other: 'Other'
}
