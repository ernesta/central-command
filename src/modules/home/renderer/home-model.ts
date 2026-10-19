import { formatClock } from '@shared/locale-names'
import { formatShortDate } from '@shared/time'
import { daysFrom } from '../shared/summary'
import type { HomeEvent, HomeSummary, HomeTask, HomeWorkspace } from '../shared/types'

/** "Coming up" looks this many days ahead, today included. */
export const COMING_UP_DAYS = 7

export interface NextMeeting {
  title: string
  date: string
  start: string | null
  route: string
  inDays: number
}

export interface HomeView {
  tasks: {
    overdue: HomeTask[]
    today: HomeTask[]
    /** The summary caps each list, so when it is cut short the counts here are not the whole story. */
    cut: boolean
  }
  comingUp: HomeEvent[]
  nextMeeting: NextMeeting | null
  /** Null where the summary does not count them for this workspace (only Research's are counted). */
  openTodos: number | null
}

const isHere = (workspace: HomeWorkspace, route: string): boolean =>
  route.startsWith(`/${workspace}/`)

/** "Today 14:00", "Tomorrow", "In 4 days 11:00": when something dated happens, for a list sorted by date. */
export function whenLabel(inDays: number, time: string | null): string {
  const day = inDays <= 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `In ${inDays} days`
  return time ? `${day} ${formatClock(time)}` : day
}

/** The one workspace's share of the summary, which holds both: its tasks, what is dated in the next 7 days, its next meeting. */
export function homeView(summary: HomeSummary, workspace: HomeWorkspace): HomeView {
  const { tasks } = summary
  const mine = (t: HomeTask): boolean => t.workspace === workspace
  const here = summary.upcoming.filter((e) => isHere(workspace, e.route))
  // Watch's items (their routes are web addresses) are not on Home yet, so they are left out rather than shown without a place to go.
  const comingUp = here.filter((e) => e.inDays <= COMING_UP_DAYS)

  const next = summary.meetings.next
  const meeting = next && next.workspace === workspace ? next : null
  const fallback = meeting ? null : here.find((e) => e.kind === 'meeting')
  const nextMeeting: NextMeeting | null = meeting
    ? {
        title: meeting.series || 'Meeting',
        date: meeting.date,
        start: meeting.start,
        route: meeting.route,
        inDays: daysFrom(summary.today, meeting.date)
      }
    : fallback
      ? {
          title: fallback.title,
          date: fallback.date,
          start: fallback.time,
          route: fallback.route,
          inDays: fallback.inDays
        }
      : null

  return {
    tasks: {
      overdue: tasks.overdue.filter(mine),
      today: tasks.today.filter(mine),
      cut: tasks.overdue.length < tasks.overdueTotal || tasks.today.length < tasks.todayTotal
    },
    comingUp,
    nextMeeting,
    openTodos: workspace === 'research' ? summary.meetings.openTodos : null
  }
}

/** The line under an item; a run of days off ends "to 2026-10-21" in the summary, which reads better as "to 21 Oct" (or "to Oct 21"). */
export function detailText(detail: string): string {
  return detail.replace(/\b\d{4}-\d{2}-\d{2}\b/, (date) => formatShortDate(date))
}
