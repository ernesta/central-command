import { daysBetween } from '@shared/year'
import { dayLabel, splitTrailingDate, whenLabel } from './dates'
import { formatDate, formatShortDate } from '@shared/time'
import { listedState, type Held } from './query'
import type { WatchItem, WatchSection, WatchSource, WatchWorkspace } from './types'

export const WORKSPACE_LABEL: Record<WatchWorkspace, string> = {
  research: 'Research',
  life: 'Life'
}

export const SECTION_NOUN: Record<WatchSection, { one: string; many: string }> = {
  training: { one: 'Training', many: 'Trainings' },
  conference: { one: 'Conference', many: 'Conferences' },
  event: { one: 'Event', many: 'Events' },
  opportunity: { one: 'Opportunity', many: 'Opportunities' }
}

/** The tags LINGUIST List puts in front of its titles ("Confs: …", "Calls: …", "Summer Schools: …"); the section already says what they say. */
const FEED_TAG = /^(?:confs?|calls?|summer schools?):\s*/i

/**
 * An item's title as the page shows it: without a feed's tag ("Confs:"), without the sentence's closing full stop, and without a
 * "Local Organiser: <name>" the page put in front of the event's own name. The stored title keeps the tag (`sectionOf` reads it).
 */
export function displayTitle(title: string): string {
  return title
    .replace(FEED_TAG, '')
    .replace(/^Local Organi[sz]ers?:\s+\p{Lu}\p{L}+(?:\s\p{Lu}\p{L}+)?\s+(?=\p{Lu}{2,})/u, '')
    .replace(/\.\s*$/, '')
    .trim()
}

/** A row's title and the date of its event, taken from the end of the title when it names one. */
export function titleParts(title: string): { name: string; when: string } {
  const { name, when } = splitTrailingDate(displayTitle(title))
  return { name: displayTitle(name), when }
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

/** When the event is: its stored dates ("14 Nov 2026", "14–17 Jul 2027"), else the date its title ends with, else nothing. */
export function whenFor(item: WatchItem): string {
  if (item.eventDate) return whenLabel(item.eventDate, item.eventEnd)
  return splitTrailingDate(displayTitle(item.title)).when
}

/** The deadline column: a deadline still to come ("Apply by 5 Nov", "Register by 3 Dec 2027" in another year), and nothing otherwise. */
export function deadlineFor(item: WatchItem, today: string): string {
  if (!item.deadline || item.deadline < today) return ''
  const sameYear = item.deadline.slice(0, 4) === today.slice(0, 4)
  return `${item.deadlineLabel ?? 'Apply by'} ${dayLabel(item.deadline, !sameYear)}`
}

export interface WatchSections {
  saved: WatchItem[]
  training: WatchItem[]
  conference: WatchItem[]
  event: WatchItem[]
  opportunity: WatchItem[]
}

/** How many new items each section of the page lists; "See all" has the rest. */
export const SHOWN_PER_SECTION = 8

/**
 * An entry added by hand whose dates have all passed. It leaves the landing like an automatic item that is over; it is never
 * deleted by code (the "See all" lists still hold it).
 */
export function isPastEntry(item: WatchItem, today: string): boolean {
  if (!item.manual) return false
  const dates = [item.eventEnd ?? item.eventDate, item.deadline].filter(
    (d): d is string => d !== null
  )
  return dates.length > 0 && dates.every((d) => d < today)
}

/**
 * The page's sections: what is saved (of any section) first, then each section's NEW items, newest first (a read item is only in
 * "See all"). A row the user opened this visit stays (`held`). An entry by hand whose dates are all over is left out.
 */
export function sectionsOf(items: readonly WatchItem[], today: string, held?: Held): WatchSections {
  const live = items.filter((i) => !isPastEntry(i, today))
  const unsaved = (section: WatchSection): WatchItem[] =>
    live.filter((i) => listedState(i, held) === 'new' && i.section === section)
  return {
    saved: live.filter((i) => i.state === 'saved').sort(bySoonestDeadline),
    training: unsaved('training'),
    conference: unsaved('conference'),
    event: unsaved('event'),
    opportunity: unsaved('opportunity')
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
