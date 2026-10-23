import { formatClock } from '@shared/locale-names'
import { formatShortDate } from '@shared/time'
import type { HomeEvent, HomeSummary, HomeTask, HomeWorkspace } from '../shared/types'

/** "Coming up" looks this many days ahead, today included. */
export const COMING_UP_DAYS = 7

export interface HomeView {
  tasks: {
    overdue: HomeTask[]
    today: HomeTask[]
    /** The summary caps each list, so when it is cut short the counts here are not the whole story. */
    cut: boolean
  }
  /** Today's timed meetings and trainings first (time order), then the rest of what is dated today. */
  todayEvents: HomeEvent[]
  /** From tomorrow on. */
  comingUp: HomeEvent[]
}

const isHere = (workspace: HomeWorkspace, route: string): boolean =>
  route.startsWith(`/${workspace}/`)

/** "13:45–15:00", or "13:45" when the end is not known. */
export function timeRange(time: string, end: string | null | undefined): string {
  return end && end !== time ? `${formatClock(time)}–${formatClock(end)}` : formatClock(time)
}

/**
 * When something dated happens: "Tomorrow 13:45–15:00", "In 4 days". Today's rows sit under "Today", so they say only the time
 * ("13:45–15:00"), or nothing for an all-day item.
 */
export function whenLabel(inDays: number, time: string | null, end?: string | null): string {
  const clock = time ? timeRange(time, end) : ''
  if (inDays <= 0) return clock
  const day = inDays === 1 ? 'Tomorrow' : `In ${inDays} days`
  return clock ? `${day} ${clock}` : day
}

const MODE_LABEL: Record<string, string> = { 'in-person': 'In person', online: 'Online' }

/** An event's second line: "Meeting · with AB, CD", "Training · Online"; the other kinds say what the summary gave. */
export function eventDetail(event: HomeEvent, initialsOf: (name: string) => string | null): string {
  if (event.kind === 'meeting') {
    const who = (event.attendees ?? []).map(initialsOf).filter((i): i is string => i !== null)
    return who.length > 0 ? `Meeting · with ${who.join(', ')}` : 'Meeting'
  }
  if (event.kind === 'training') {
    const mode = event.mode ? MODE_LABEL[event.mode] : undefined
    return mode ? `Training · ${mode}` : 'Training'
  }
  return detailText(event.detail)
}

/** The one workspace's share of the summary, which holds both: its tasks, and what is dated in the next 7 days. */
export function homeView(summary: HomeSummary, workspace: HomeWorkspace): HomeView {
  const { tasks } = summary
  const mine = (t: HomeTask): boolean => t.workspace === workspace
  const here = summary.upcoming.filter((e) => isHere(workspace, e.route))
  // Watch's items (their routes are web addresses) are not on Home yet, so they are left out rather than shown without a place to go.
  const comingUp = here.filter((e) => e.inDays >= 1 && e.inDays <= COMING_UP_DAYS)
  // The summary is sorted by date then time; an untimed item (a day off) follows the timed ones.
  const todayEvents = here
    .filter((e) => e.inDays <= 0)
    .sort(
      (a, b) =>
        Number(a.time === null) - Number(b.time === null) ||
        (a.time ?? '').localeCompare(b.time ?? '')
    )

  return {
    tasks: {
      overdue: tasks.overdue.filter(mine),
      today: tasks.today.filter(mine),
      cut: tasks.overdue.length < tasks.overdueTotal || tasks.today.length < tasks.todayTotal
    },
    todayEvents,
    comingUp
  }
}

/** The line under an item; a run of days off ends "to 2026-10-21" in the summary, which reads better as "to 21 Oct" (or "to Oct 21"). */
export function detailText(detail: string): string {
  return detail.replace(/\b\d{4}-\d{2}-\d{2}\b/, (date) => formatShortDate(date))
}
