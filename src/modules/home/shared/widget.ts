import type { WatchWorkspace } from '../../watch/shared/types'
import { byUrgency } from './summary'
import { HOME_WORKSPACES, type HomeSummary, type HomeTask, type HomeWorkspace } from './types'

/**
 * The small file a Mac widget reads. Plain JSON, versioned, no more than a widget draws: nothing the widget has to
 * work out, and nothing it is not meant to show. Written next to the app's other data; it never leaves the Mac.
 */
export interface WidgetHours {
  label: 'This week' | 'This month'
  minutes: number
  aimMinutes: number
  todayMinutes: number
  clients: { client: string | null; minutes: number }[]
}

export interface WidgetSnapshot {
  version: 1
  generatedAt: string
  today: string
  timer: { label: string; minutes: number } | null
  /** Overdue first, then due today; at most five. */
  tasks: { title: string; list: string; overdue: boolean; workspace: HomeWorkspace }[]
  /** Every workspace's tasks together, and each workspace's own. */
  taskCounts: { overdue: number; today: number }
  taskCountsByWorkspace: Record<HomeWorkspace, { overdue: number; today: number }>
  nextMeeting: { title: string; date: string; time: string | null } | null
  /** Research's time so far (the week), counted as the Hours page counts it: derived hours included. */
  week: WidgetHours | null
  /** Work's time so far (the invoice month or week), the same way; added without a version bump while nothing reads the file. */
  work: WidgetHours | null
  /** Life's time so far (the week, no aim), the same way; added without a version bump, like `work`. */
  life: WidgetHours | null
  /** New Watch items, not yet looked at, in every workspace and in each. */
  watchNew: number
  watchNewByWorkspace: Record<WatchWorkspace, number>
  weather: {
    temperature: number
    unit: 'celsius' | 'fahrenheit'
    description: string
    place: string
  } | null
}

export const WIDGET_TASKS = 5

export function buildWidgetSnapshot(summary: HomeSummary): WidgetSnapshot {
  const shown = (pick: (w: HomeWorkspace) => HomeTask[]): HomeTask[] =>
    HOME_WORKSPACES.flatMap(pick).sort(byUrgency)
  const tasks = [
    ...shown((w) => summary.tasks[w].overdue).map((t) => ({
      title: t.title,
      list: t.list,
      overdue: true,
      workspace: t.workspace
    })),
    ...shown((w) => summary.tasks[w].today).map((t) => ({
      title: t.title,
      list: t.list,
      overdue: false,
      workspace: t.workspace
    }))
  ].slice(0, WIDGET_TASKS)
  const byWorkspace = Object.fromEntries(
    HOME_WORKSPACES.map((w) => [
      w,
      { overdue: summary.tasks[w].overdueTotal, today: summary.tasks[w].todayTotal }
    ])
  ) as WidgetSnapshot['taskCountsByWorkspace']
  const watchNew = {
    research: summary.watch.research?.counts.new ?? 0,
    life: summary.watch.life?.counts.new ?? 0
  }
  const m = summary.meetings.next
  return {
    version: 1,
    generatedAt: summary.generatedAt,
    today: summary.today,
    timer: summary.timer ? { label: summary.timer.label, minutes: summary.timer.minutes } : null,
    tasks,
    taskCounts: {
      overdue: HOME_WORKSPACES.reduce((n, w) => n + byWorkspace[w].overdue, 0),
      today: HOME_WORKSPACES.reduce((n, w) => n + byWorkspace[w].today, 0)
    },
    taskCountsByWorkspace: byWorkspace,
    nextMeeting: m ? { title: m.series || 'Meeting', date: m.date, time: m.start } : null,
    week: summary.hours.research,
    work: summary.hours.work,
    life: summary.hours.life,
    watchNew: watchNew.research + watchNew.life,
    watchNewByWorkspace: watchNew,
    weather: summary.weather
      ? {
          temperature: summary.weather.now.temperature,
          unit: summary.weather.unit,
          description: summary.weather.now.description,
          place: summary.weather.place
        }
      : null
  }
}
